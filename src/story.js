const inkjs = require('inkjs');

//Ink Story
class Story extends inkjs.Story {
	currentLine = 0;

	constructor(file) {
		var inkJson = new inkjs.Compiler(file).Compile().ToJson()
		super(inkJson)

		this.log = [];
		this.currentLine = 0;

		/*
		this.variablesState["cast"].all.forEach((value, key, map) => {
			this.variablesState["cast"].set(key, Date.now())
			console.log(this.variablesState["cast"])
		})
		console.log("Cast", this.variablesState["cast"].all)
		*/
		
		this.updateLog = this.updateLog.bind(this);
		this.updateChoices = this.updateChoices.bind(this);
		this.selectChoice = this.selectChoice.bind(this);
	}

	updateTurn() {
		let tag = this.currentTags
			?.find(tag => tag.startsWith("turn"))
			?.match(/^turn: (?<player>.+)/).groups.player

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
