//Ink Story
var Story = require('inkjs').Story;

var fs = require('fs');
const story_path = "intercept.ink.json";
var inkFile = fs.readFileSync(story_path, 'UTF-8').replace(/^\uFEFF/, '');
var story = new Story(inkFile);

//Server
const express = require('express')
const app = express()

app.use(express.urlencoded({extended: true}))
app.use(express.static('public'))

const hostname = '127.0.0.1';
const port = 8080;

class TextLog {
	currentLine = 0;

	constructor() {
		this.log = [];
		this.currentLine = 0;
	}

	getLine(index, story){
		index -= 1
		if(index <= this.currentLine) {
			return this.log[index]
		} else {
			if ( story.canContinue ) {
				this.log.push(story.Continue())
				this.currentLine += 1

				clients.forEach( client => client.response.write(`event: New content\ndata:${this.currentLine}\n\n`))
				return this.log[ this.log.length - 1]
			}
		}
	}

	makeChoice(index, story){
		let choice = story.currentChoices[index]

		console.log(`Choosing [${index}] `); console.log(`${choice.text}`)
		story.ChooseChoiceIndex(index)

		this.log.push(story.Continue())
		this.currentLine += 1
		clients.forEach( client => client.response.write(`event: New content\ndata:${this.currentLine}\n\n`))
	}
}

var textlog = new TextLog()

let clients = []

app.get('/stream', (req, res) => {
	res.writeHead(200, {
		'Content-Type': "text/event-stream",
		'Connection': "keep-alive",
	})

	res.write("data: Subscribed!\n\n")

	//Save connection handel
	let clientId = 0;
	clients.push({id: clientId, response: res })

	req.on('close', () => {
		console.log(`${clientId} Connection closed`);
		clients = clients.filter(client => client.id !== clientId);
	})
	
});
app.get('/update/log', ( req, res) => {
	let index = req.body['line']
	if ( req.query != undefined ) {
		index = req.query['line']
	}

	console.log(`line = ${index}`)

	let nextLine = textlog.getLine(index, story)

	console.log(nextLine, "\n")

	res.statusCode = nextLine === undefined ? 204 : 200;
	res.setHeader('Content-Type', 'text/plain');
	res.send(nextLine);
});

app.get('/update/choices', ( req, res) => {
	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/plain');

	res.send(JSON.stringify(story.currentChoices.map((c) => 
		`[${c.index}] ${c.text}\ntags:${c.tags}`)));
});

app.post('/choose', ( req, res) => {
	textlog.makeChoice(req.body['index'], story)
	if ( req.query != undefined ) {
		index = req.query['line']
	}

	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/plain');

	res.send(res.send(story.canContinue));
});

app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
