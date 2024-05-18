use tokio::{
    net::{ TcpListener, },
    sync::{broadcast, },
};
use hyper::{
    server::conn::http1,
    service::service_fn,
};

type Res = hyper::Response<http_body_util::Full<hyper::body::Bytes>>;
type Req = hyper::Request<hyper::body::Incoming>;

type ServerError = Box<dyn std::error::Error + Send + Sync>;

enum Route {
    Stream,
    UpdateLog,
    GetChoices,
    Choose,
    Invalid,
}
impl Route {
    //Route uri's defined here
    fn from_path<P: AsRef<str>>(path: P) -> Route {
        match path.as_ref() {
            "/stream" => Route::Stream,
            "/update/log" => Route::UpdateLog,
            "/update/choices" => Route::GetChoices,
            "/choose" => Route::Choose,
            _ => Route::Invalid,
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), ServerError>{
    let addr = ("127.0.0.1", 8080);
    let listener = TcpListener::bind(addr).await?;

    let (sender, _) = broadcast::channel(10);
    let sender2 = sender.clone();

    let story_thread = tokio::task::spawn(async move {
        let story_str = std::fs::read_to_string("test.ink.json").expect("Not a valid file");
        let mut story = bladeink::story::Story::new(story_str.as_str())?;

        let sender = sender2.clone();

        println!("Starting story");
        loop {
            while story.can_continue() {
                let line = story.cont()?;

                sender.send(line.clone())?;
                println!("Sent {}", line);
            }

            let choices = story.get_current_choices();

            if !choices.is_empty() {
            }
            else {
                break;
            }

        }

        Ok::<(), ServerError>(())

    });

    loop { 
        let (stream, _) = listener.accept().await?;
        let io = hyper_util::rt::TokioIo::new(stream);

        let sender = sender.clone();

        tokio::task::spawn(async move {
            match http1::Builder::new().serve_connection(io, service_fn(move |req| respond(req, sender.clone().subscribe()))).await{
                Ok(res) => { res }
                Err(err) => {
                    eprintln!("Error with connection: {err:?}");
                },
            }
        });

        //Check story thread
        if story_thread.is_finished() {
            return story_thread.await?
        }
    }
}

async fn respond(req: Req, mut story_stream: broadcast::Receiver<String>) -> Result<Res, ServerError> {

    let (status, body) = if let Some(uri) = req.uri().path_and_query() {
        match Route::from_path(uri.path()) {
            Route::Stream => {
                let quries = get_queries(uri.query());
                if let Some(name) = quries.get("name") { println!("Name: {name}") };
                
                (hyper::StatusCode::OK, "Stream".to_string())
            },
            Route::UpdateLog  => {
                let text = story_stream.recv().await?;
                (hyper::StatusCode::OK, text)
            },
            Route::GetChoices => (hyper::StatusCode::OK, "Get Choices".to_string()),
            Route::Choose     => (hyper::StatusCode::OK, "Choose".to_string()),
            Route::Invalid    => (hyper::StatusCode::NOT_FOUND, format!("Invalid path: '{}'", uri.path())),
        }
    } else {
        (hyper::StatusCode::BAD_REQUEST, String::new())
    };

    Ok( hyper::Response::builder()
        .status(status)
        .body(http_body_util::Full::<hyper::body::Bytes>::from(body))?
    )
}

fn get_queries<'a>(uri: Option<&'a str>) -> std::collections::HashMap<&'a str, &'a str> {
    if let Some(q) = uri{
        std::collections::HashMap::from_iter(q.split("&").map(|q| {
            let mut pair = q.split("=");
            (pair.next().unwrap_or(""), pair.next().unwrap_or(""))
        }))
    } else {
        std::collections::HashMap::new()
    }
}
