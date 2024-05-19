//Ink Story
var Story = require('inkjs').Story;

var fs = require('fs');
const story_path = "test.ink.json";
var inkFile = fs.readFileSync(story_path, 'UTF-8').replace(/^\uFEFF/, '');
var story = new Story(inkFile);

//Server
const { createServer } = require('http');

const hostname = '127.0.0.1';
const port = 8080;

const server = createServer((req, res) => {
	switch (req.url) {
		case '/update/log':
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.end(story.Continue());
			break;
		case '/update/choices':
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');

			var i = 1;
			res.end(JSON.stringify(story.currentChoices.map((c) => c.text)));
			break;
		default:
			res.statusCode = 404;
			res.setHeader('Content-Type', 'text/plain');
			res.end(`Invalid path: ${req.url}`);
	}
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
