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

app.get('/update/log', ( req, res) => {
	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/plain');
	res.send(story.Continue());
});
app.get('/update/choices', ( req, res) => {
	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/plain');

	res.send(JSON.stringify(story.currentChoices.map((c) => c.text)));
});
app.post('/choose', ( req, res) => {
	console.log("Method: "+ req.method)
	console.log("Headers:")
	for (var h in req.headers) {
		console.log("\t"+h)
	}
	console.log("Content Type: "+req.headers['content-type'])
	console.log(`Form: `)
	for ( item in req.body ) {
		console.log(`\t${item}: ${req.body[item]}`)
	}
	res.json(req.body)

	//res.statusCode = 200;
	//res.setHeader('Content-Type', 'text/plain');

	//res.send(JSON.stringify(story.currentChoices.map((c) => c.text)));
});

app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
