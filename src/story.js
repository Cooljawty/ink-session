const config = require('config')
const inkjs = require('inkjs');
const fs = require('fs');

//Ink Story
class Story extends inkjs.Story {
	currentLine = 0;

	constructor(file) {
		var inkJson = new inkjs.Compiler(file).Compile().ToJson()
		super(inkJson)

		this.log = [];
		this.currentLine = 0;

		this.cast = new Map();
		this.variablesState[config.get('ink_variables.cast')]
			.all.forEach((value, key, map) => {
			this.cast.set(JSON.parse(key).itemName, null)
		})
		
		this.getMetadata = this.getMetadata.bind(this);
		this.updateLog = this.updateLog.bind(this);
		this.updateChoices = this.updateChoices.bind(this);
		this.selectChoice = this.selectChoice.bind(this);
	}

	static load(path){
		var inkFile = fs.readFileSync(path, {encoding: 'UTF-8'});
		var story   = new Story(inkFile);
		if ( fs.existsSync(config.get('save_path.state')) ) {
			console.log("Restoring save state")
			var prevState = fs.readFileSync(config.get('save_path.state'), {encoding: 'UTF-8'});
			story.state.LoadJson(prevState)

			var prevLog = fs.readFileSync(config.get('save_path.log'), {encoding: 'UTF-8'});
			({log: story.log, currentLine: story.currentLine} = JSON.parse(prevLog))
		}

		return story
	}

	castClient(client){
		for (var [name, id] of this.cast.entries()){
			if (id == client){
				console.log(client, "recasted as", name)
				return name
			}
		}

		for (var [name, id] of this.cast.entries()){
			if (id == null){
				console.log(client, "casted as", name)
				this.cast.set(name, client)
				return name
			}
		}

		return null
	}

	updateTurn() {
		const turnTag = config.get('ink_variables.turn');
		let pattern = new RegExp(`^${turnTag}: (?<player>.+)`);
		let tag = this.currentTags
			?.find(tag => tag.startsWith(turnTag))
			?.match(pattern).groups.player

		this.turn = tag ? tag : this.turn

		console.log(`${this.turn}'s turn`)
	}

	getLine(index){
		if(index <= this.currentLine) {
			return { 
				text: this.log[index-1], 
				currentLine: this.currentLine, 
			}
		} else {
			if ( this.canContinue ) {
				this.log.push(this.Continue())
				this.currentLine += 1

				this.updateTurn()

				return { 
					text: this.log[ this.log.length - 1], 
					currentLine: this.currentLine, 
				}
			}
		}
	}

	makeChoice(index){
		let choice = this.currentChoices[index]

		this.ChooseChoiceIndex(index)

		this.log.push(this.Continue())
		this.currentLine += 1
	}

	save(){
		const stateSavePath = config.get('save_path.state')
		const logSavePath = config.get('save_path.log')
		fs.writeFileSync(stateSavePath, this.state.toJson())
		fs.writeFileSync(logSavePath, JSON.stringify({
			log: this.log,
			currentLine: this.currentLine
		}))
	}

	//Middleware methods
	getMetadata(req, res, next){
		res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
		const pattern = /^(\w+): (.+)/
		let metadata = this.globalTags.reduce((map, pair) => {
			let [_, key, value] = pair.match(pattern)
			map[key] = value
			return map
		},{})
		res.send(metadata);

		//next()
	}

	updateLog(req, res, next){
		let index = req.body['line']
		if ( req.query != undefined ) {
			index = req.query['line']
		}

		let nextLine = this.getLine(index)

		res.statusCode = nextLine === undefined ? 204 : 200;
		res.setHeader('Content-Type', 'text/plain');
		res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
		res.send(nextLine);

		next()
	}

	updateChoices(req, res, next){
		let choices = this.turn != res.locals.clientName ? [] : this.currentChoices.map( choice => {
			return {
				index: choice.index,
				text: choice.text,
				tags: choice.tags,
			}
		})

		res.statusCode = this.currentChoices.length === 0 ? 204 : 200;
		res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
		res.send(choices);

		next()
	}

	selectChoice(req, res, next){
		let index = req.body['index']
		if ( req.query != undefined ) {
			index = req.query['index']
		}

		if (this.turn == res.locals.clientName) { 
			this.makeChoice(index, index) 
		}

		res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
		res.send(this.canContinue);

		next()
	}

}

module.exports = {
	Story: Story,
}
