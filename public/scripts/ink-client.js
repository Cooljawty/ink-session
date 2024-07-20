const route = {
	eventStream: '/stream',
	updateLog: '/update/log',
	updateChoices: '/update/choices',
	getMetadata: '/metadata',
	sendChoice: '/choose',
}

const updates = new EventSource(route["eventStream"])

var currentLine = 0;
window.addEventListener('load', updateLog)
window.addEventListener('load', updateChoices)
getMetadata();

async function getMetadata(){
	let metadata = await fetch(route['getMetadata'])
		.then(res => res.json())

	document.getElementById('title').innerText = metadata['title']
	if(metadata['author']){
		document.getElementById('author').innerText = `by ${metadata['author']}`
	}
}

async function updateLog(event){
	//Skip if up to date
	let index = event.data
	if(index != undefined && index <= currentLine) { return }

	let text, line;
	let nextLine = currentLine+1; 
	do {
		({text, currentLine: line} = await fetch(`${route['updateLog']}?line=${nextLine}`)
			.then((response) => response.json()))

		if ( text != undefined ) {
			currentLine = nextLine
			nextLine += 1

			//Prevent line duplication
			let id = `line${currentLine}`
			if ( document.querySelector(`#${id}.storytext`) === null){
				appendLine(id, text)
			}

		}

	} while( nextLine <= line ) 

	updateChoices(event)
};

async function continueLog(event){
		({text, currentLine: line} = await fetch(`${route['updateLog']}?line=${currentLine+1}`)
			.then((response) => response.json()))

		if ( text != undefined ) {
			currentLine += 1
			
			//Prevent line duplication
			let id = `line${currentLine}`
			if ( document.querySelector(`#${id}.storytext`) === null){
				appendLine(id, text)
			}

			updateChoices(event)
		}
};

async function updateChoices(event){
	let choices = await fetch(route['updateChoices'])
		.then((response) => response)

	if ( choices.ok ) {
		let choiceBox = document.querySelector(".storychoices")

		const waitingForClient = choices.status === 204;
		choices = await choices.json()
			.then((json) => json)
			.catch(error => {
				if(!waitingForClient){ console.error(error) }
				return []
			})

		let newChoices = choices.map(choice => appendChoice( choice.text, function(event) {
				fetch(`${route['sendChoice']}?index=${choice.index}`, {method: "post"}).await
				continueLog().await
			})
		);

		if ( newChoices.length === 0 ){
			if(waitingForClient) {
				newChoices.push(appendChoice("continue..", continueLog))
			}
			updates.addEventListener('New content', updateLog, {once: true})
			updates.addEventListener('New content', updateChoices, {once: true})
		}

		function appendChoice(text, onclick) {
			let newChoice = document.createElement('a')
			newChoice.href = '#choices'
			newChoice.classList.add("choice")
			newChoice.innerText = text
			newChoice.onclick = onclick

			let choiceParagraph = document.createElement('p')
			choiceParagraph.classList.add("storytext")
			choiceParagraph.append(newChoice)
			
			return choiceParagraph
		}

		choiceBox.replaceChildren(...newChoices)
	}
};

function appendLine(id, text) {
	let newLine = document.createElement('p')
	newLine.innerText = text.trimEnd()

	newLine.id = id
	newLine.classList.add("storytext")

	document.querySelector(".storylog").append(newLine)

	newLine.scrollIntoView({behavior: 'smooth', block: 'center', inline: 'nearest'})
}
