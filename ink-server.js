//Ink Story
var Story = require('inkjs').Story;

var fs = require('fs');
const story_path = "test.ink.json";
var inkFile = fs.readFileSync(story_path, 'UTF-8').replace(/^\uFEFF/, '');
var story = new Story(inkFile);

//Server
const express = require('express')
const app = express()

app.use(express.urlencoded({extended: true}))

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
			return this.log[index]
		} else {
			if ( story.canContinue ) {
				return story.Continue()
			}
		}
	}
}

var textlog = new TextLog()

app.get('/update/log', ( req, res) => {
	let nextLine = textlog.getLine(req.body['line'], story)

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
	let choiceIndex = req.body['index']
	let choice = story.currentChoices[ choiceIndex ]

	console.log(`Choosing [${choiceIndex}] ${choice.text}`)
	story.ChooseChoiceIndex(choiceIndex)

	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/plain');

	res.send(res.send(story.canContinue));
});

app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
