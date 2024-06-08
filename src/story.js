const inkjs = require('inkjs');

//Ink Story
class Story extends inkjs.Story {
	currentLine = 0;

	constructor(file) {
		var inkJson = new inkjs.Compiler(file).Compile().ToJson()
		super(inkJson)

		this.log = [];
		this.currentLine = 0;

		this.variablesState["cast"].all.forEach((value, key, map) => {
			this.variablesState["cast"].set(key, Date.now())
			console.log(this.variablesState["cast"])
		})
		console.log("Cast", this.variablesState["cast"].all)

	}

	updateTurn() {
		let tag = this.currentTags
			?.find(tag => tag.startsWith("turn"))
			?.match(/^turn: (?<player>.+)/).groups.player

		this.turn = tag ? tag : this.turn
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

				this.updateTurn()
				console.log(`${this.turn}'s turn`)

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

	save(){
		const stateSavePath = config.get('save_path.state')
		const logSavePath = config.get('save_path.log')
		fs.writeFileSync(stateSavePath, this.state.toJson())
		fs.writeFileSync(logSavePath, JSON.stringify({
			log: this.log,
			currentLine: this.currentLine
		}))
	}
}

module.exports = {
	Story: Story,
}
