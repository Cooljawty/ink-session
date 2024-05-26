var currentLine = 0;

const route = {
	eventStream: '/stream',
	updateLog: '/update/log',
	updateChoices: '/update/choices',
	sendChoice: '/choose',
}

async function updateLog(event){
	//Skip if up to date
	let index = event.data
	if(index != undefined && index <= currentLine) { return }

	let text, line ;
	let next = currentLine+1; 
	do {
		({text, currentLine: line} = await fetch(`${route['updateLog']}?line=${next}`)
			.then((response) => response.json()))

		if ( text === undefined ) { break }


		//Prevent line duplication
		let id = `line${next}`
		if ( document.querySelector(`#${id}.storytext`) === null){
			appendLine(id, text)
		}

		currentLine = next
		next += 1
	} while( next <= line ) 
};

async function continueLog(event){
		({text, currentLine: line} = await fetch(`${route['updateLog']}?line=${currentLine+1}`)
			.then((response) => response.json()))

		if ( text === undefined ) { return }


		//Prevent line duplication
		let id = `line${next}`
		if ( document.querySelector(`#${id}.storytext`) === null){
			appendLine(id, text)
		}

		currentLine += 1
};

async function updateChoices(event){
	event.preventDefault()

	let index = event.data
	let choices = await fetch(route['updateChoices'])
		.then((response) => response.json())
		.then((json) => json)

	if ( choices != undefined ) {
		let choiceBox = document.querySelector(".storychoices")
		let newChoices = []
		for ( choice of choices ) {
			appendChoice( choice.text, (event) => {
				fetch(`${route['sendChoice']}?index=${choice.index}`, {method: "post"}).await
			})
		}

		if ( newChoices.length === 0 ){
			appendChoice("continue..", continueLog)
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
			newChoices.push(choiceParagraph)
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

const updates = new EventSource(route["eventStream"])
updates.addEventListener('New content', updateLog)
updates.addEventListener('New content', updateChoices)
updates.addEventListener('New choices', updateChoices)

window.addEventListener('load', updateLog)
window.addEventListener('load', updateChoices)
