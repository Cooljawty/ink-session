const config = require('config')
const inkjs = require('inkjs');
const fs = require('fs');

class Story extends inkjs.Story {
	currentLine = 0;

	/**
	* file: Path to an .ink file
	*/
	constructor(file) {
		var inkJson = new inkjs.Compiler(file).Compile().ToJson()
		super(inkJson)

		this.log = [];
		this.currentLine = 0;
		
		//Collection of functions that block sending choices to client
		this.choiceGuards = []; 

		this.cast = new Map();
		if(this.variablesState[config.get('ink_variables.cast')]){
			this.variablesState[config.get('ink_variables.cast')]
				?.all.forEach((value, key, map) => {
				this.cast.set(JSON.parse(key).itemName, null)
			})

			this.updateTurn()
			this.choiceGuards.push((choice, req, res, next) => 
				this.turn === undefined || 
				this.turn === res.locals.clientName
			});
		}
		
		this.castClient = this.castClient.bind(this);
		this.getMetadata = this.getMetadata.bind(this);
		this.updateLog = this.updateLog.bind(this);
		this.updateChoices = this.updateChoices.bind(this);
		this.selectChoice = this.selectChoice.bind(this);
	}


	/** Loads an ink story and restores it's saved state if one exists
	 *
	 * @constructs Story 
	 * path: Path to an .ink file
	 */
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

	/** Assigns a client to a name in the cast from the global cast list
	 *
	 * client: The id of a connected client
	 */
	assignName(client){
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

	/** Gets the current turn based on tags set in the .ink source file
	 *
	 * The turn decieds what clients can make a choice selection to continue
	 * the story.
	 */
	updateTurn() {
		const turnTag = config.get('ink_variables.turn');
		let pattern = new RegExp(`^${turnTag}: (?<player>.+)`);
		let tag = this.currentTags
			?.find(tag => tag.startsWith(turnTag))
			?.match(pattern).groups.player

		this.turn = tag ? tag : this.turn

		console.log(`${this.turn}'s turn`)
	}

	/** Gets the next line of text after a given index
	 *
	 *  index: Which line to recive from the story log
	 *  Returns the requested line of text and the index of the most recent line
	 */ 
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

	/** Saves the current story state and a log of all preveous lines
	 *
	 * The save path is obtained from a configuration file
	 */
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
	
	/** Returns any global tags as metadata 
	 *
	 * return: { tagName: value }
	 * */
	getMetadata(req, res, next){
		res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
		const pattern = /^(\w+): (.+)/
		let metadata = this.globalTags.reduce((map, pair) => {
			let [_, key, value] = pair.match(pattern)
			map[key] = value
			return map
		},{})
		res.send(metadata);

		next()
	}

	/** Assigns the client attached to connection to a name in the cast list
	 *
	 * Must be called after Session#assignId in order to get the client's id
	 */
	castClient(req, res, next){
		const clientId = res.locals.clientId;

		let clientName = this.assignName(clientId);
		res.locals.clientName = clientName;

		res.cookie('name', clientName, {sameSite: 'Strict'})

		next()
	}

	/** Returns the next line after the current line the client is on
	 *
	 * The client's current line can be obtained from 
	 * the request body or as a query
	 *
	 * return: { text: String, currentLine: Number }
	 */
	updateLog(req, res, next){
		let index = req.body['line']
		if ( req.query != undefined ) {
			index = req.query['line']
		}

		let nextLine = this.getLine(index)

		res.locals.currentLine = this.currentLine;

		res.statusCode = nextLine === undefined ? 204 : 200;
		res.setHeader('Content-Type', 'text/plain');
		res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
		res.send(nextLine);


		next()
	}

	/** Returns the list of choices availabe to the client
	 *
	 * If there are choice available to another client then the status
	 * is set to 204 to indicate the client must wait for someone else to select 
	 *
	 * return: [{ index: Number, text: String, tags: Ink.Tag }, ..] 
	 */
	updateChoices(req, res, next){
		let choices = this.currentChoices
			.filter( choice => 
				this.choiceGuards.every( guard => 
					guard(choice, req, res, next)
				)
			)
			.map( choice => {
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


	/** Makes a choice selection 
	 *
	 * The client's name must match the current turn
	 */
	selectChoice(req, res, next){
		let index = req.body['index']
		if ( req.query != undefined ) {
			index = req.query['index']
		}

		if (this.turn == res.locals.clientName) { 
			this.makeChoice(index, index) 
		}

		res.locals.currentLine = this.currentLine;

		res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
		res.send(this.canContinue);

		next()
	}

}

module.exports = {
	Story: Story,
}
