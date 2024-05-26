//Ink Story
class Story extends require('inkjs').Story {
	currentLine = 0;
	constructor(file) {
		super(file)

		this.log = [];
		this.currentLine = 0;
	}

	getLine(index){
		if(index <= this.currentLine) {
			return { 
				text: this.log[index-1], 
				currentLine: story.currentLine, 
			}
		} else {
			if ( this.canContinue ) {
				this.log.push(this.Continue())
				this.currentLine += 1

				if ( this.currentChoices.leng != 0 ){
					clients.forEach( client => client.response.write(`event: New choices\ndata:${this.currentChoices.length}\n\n`))
				}

				clients.forEach( client => client.response.write(`event: New content\ndata:${this.currentLine}\n\n`))
				return { 
					text: this.log[ this.log.length - 1], 
					currentLine: story.currentLine, 
				}
			}
		}
	}

	makeChoice(index){
		let choice = this.currentChoices[index]

		this.ChooseChoiceIndex(index)

		this.log.push(this.Continue())
		this.currentLine += 1
		clients.forEach( client => client.response.write(`event: New content\ndata:${this.currentLine}\n\n`))
		clients.forEach( client => client.response.write(`event: New choices\ndata:${this.currentChoices.length}\n\n`))
	}
}


var fs = require('fs');
const story_path = "intercept.ink.json";
var inkFile = fs.readFileSync(story_path, 'UTF-8').replace(/^\uFEFF/, '');
var story = new Story(inkFile);

//Server
const express = require('express')
const app = express()

const hostname = '127.0.0.1';
const port = 8080;
const route = {
	pages: 'public',

	eventStream: '/stream',
	updateLog: '/update/log',
	updateChoices: '/update/choices',
	sendChoice: '/choose',
}

app.use(express.urlencoded({extended: true}))
app.use(express.static(route['pages']))

let clients = []

app.get(route['eventStream'], (req, res) => {
	res.writeHead(200, {
		'Content-Type': "text/event-stream",
		'Connection': "keep-alive",
	})

	res.write("data: Subscribed!\n\n")

	//Save connection handel
	let clientId = Date.now();
	clients.push({id: clientId, response: res })

	req.on('close', () => {
		console.log(`${clientId} Connection closed`);
		clients = clients.filter(client => client.id !== clientId);
	})
	
});
app.get(route['updateLog'], ( req, res) => {
	let index = req.body['line']
	if ( req.query != undefined ) {
		index = req.query['line']
	}

	let nextLine = story.getLine(index)

	res.statusCode = nextLine === undefined ? 204 : 200;
	res.setHeader('Content-Type', 'text/plain');
	res.send(nextLine);
});

app.get(route['updateChoices'], ( req, res) => {
	let choices = story.currentChoices.map( choice => {
		return {
			index: choice.index,
			text: choice.text,
			tags: choice.tags,
		}
	})
	res.send(choices);
});

app.post(route['sendChoice'], ( req, res) => {
	let index = req.body['index']
	if ( req.query != undefined ) {
		index = req.query['index']
	}

	story.makeChoice(index, story)

	res.send(res.send(story.canContinue));
});

app.listen(port, hostname, () => {
	console.log(`Server running at http://${hostname}:${port}/`);
	
	setTimeout(()=>{
		clients.forEach( client => client.response.write(`data: ping\n\n`))
	}, 100);
});
