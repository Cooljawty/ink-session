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
		if(index <= this.currentLine) {
			return this.log[index-1]
		} else {
			if ( story.canContinue ) {
				this.log.push(story.Continue())
				this.currentLine += 1

				if ( story.currentChoices.leng != 0 ){
					clients.forEach( client => client.response.write(`event: New choices\ndata:${story.currentChoices.length}\n\n`))
				}

				clients.forEach( client => client.response.write(`event: New content\ndata:${this.currentLine}\n\n`))
				return this.log[ this.log.length - 1]
			}
		}
	}

	makeChoice(index, story){
		let choice = story.currentChoices[index]

		story.ChooseChoiceIndex(index)

		this.log.push(story.Continue())
		this.currentLine += 1
		clients.forEach( client => client.response.write(`event: New content\ndata:${this.currentLine}\n\n`))
		clients.forEach( client => client.response.write(`event: New choices\ndata:${story.currentChoices.length}\n\n`))
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
	let choices = story.currentChoices.map( choice => {
		return {
			index: choice.index,
			text: choice.text,
			tags: choice.tags,
		}
	})
	res.send(choices);
});

app.post('/choose', ( req, res) => {
	let index = req.body['index']
	if ( req.query != undefined ) {
		index = req.query['index']
	}

	console.log(`Choice ${index}`)
	textlog.makeChoice(index, story)

	res.send(res.send(story.canContinue));
});

app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
