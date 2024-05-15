use tokio::net::{ TcpListener, };
use hyper::{
    server::conn::http1,
    service::service_fn,
};

type Res = hyper::Response<http_body_util::Full<hyper::body::Bytes>>;
type Req = hyper::Request<hyper::body::Incoming>;

type ServerError = Box<dyn std::error::Error + Send + Sync>;

const stream_uri: &str = "/stream";

#[tokio::main]
async fn main() -> Result<(), ServerError>{
    let addr = ("127.0.0.1", 8080);
    let listener = TcpListener::bind(addr).await?;

    while let (stream, _) = listener.accept().await? {
        let io = hyper_util::rt::TokioIo::new(stream);

        tokio::task::spawn(async move {
            if let Err(err) = http1::Builder::new()
                .serve_connection(io, service_fn(respond)).await
            {
                eprintln!("Error with connection: {err:?}");
            }
        });
    }

    Ok(())
}

async fn respond(req: Req) -> Result<Res, String> 
{
    if req.uri().path() == stream_uri {
        Ok(hyper::Response::new(http_body_util::Full::<hyper::body::Bytes>::from("Hello World")))
    } else {
        // Note: it's usually better to return a Response
        // with an appropriate StatusCode instead of an Err.
        Err("not HTTP/1.1, abort connection".to_string())
    }
}
