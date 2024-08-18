const config = require('config')


class Session {
	constructor(app) {
		this.clients = new Map;

		this.subscribe = this.subscribe.bind(this);
		this.assignId = this.assignId.bind(this);
		this.updateClients = this.updateClients.bind(this);
		this.appendClientName = this.appendClientName.bind(this);
	}

	/** Assigns an id to new connections
	 *
	 * Should be called before Session#subscribe
	 */
	assignId(req, res, next){
		let cookieId = parseCookie(req, 'clientId');
		let clientId = cookieId ? cookieId : Date.now();
		if (!cookieId) {
			while(this.clients.get(clientId)) { clientId += 1 } //Iterate until unique id found
		}

		res.cookie('clientId', clientId, {sameSite: 'Strict'})
		res.locals.clientId = clientId

		next()
	}

	/** Adds connection to list of clients
	 *
	 * The clientId should be obtaind by calling Session#assignId
	 * The clientName is obtaind by calling story#castClient
	 */
	subscribe(req, res, next){
		const clientId = res.locals.clientId;
		const clientName = res.locals.clientName;

		this.clients.set(clientId, {response: res, name: clientName})

		const heartbeat = setInterval(
			()=>res.write(':ping\n\n'), 
			config.get('heartbeatInterval')
		);

		req.on('close', () => {
			console.log(`${clientId} Connection closed`)
			clearInterval(heartbeat)

			this.clients.delete(clientId)

			/*
			setTimeout(
				function(){ app.emit('client disconnected') }, 
				config.get('sessionTimeout')
			)
			*/
		})

		res.writeHead(200, {
			'Content-Type': "text/event-stream",
			'Connection': "keep-alive",
		});
		res.write("data: Subscribed!\n\n")

		console.log("Client", clientId, "connected")
		next()
	}

	/** Sends an update event to all connected clients when new content is recived */
	updateClients(req, res, next){
		this.clients.forEach( function(client){
			client.response.write(`event: New content\ndata:${res.locals.currentLine}\n\n`)
		});

		next()
	}

	/** Adds the client name from the cookie 
	 *
	 * This is needed by Story.updateChoices() and Story.selectChoice()
	 */
	appendClientName(req, res, next) {
			let clientId = parseCookie(req, 'clientId');
			res.locals.clientName = this.clients.get(clientId)?.['name'];

			next()
	}
}

function parseCookie(req, key){
	return req.get('Cookie')?.split(";")
		.find(item => item.startsWith(key))
		?.split('=')[1]
}

module.exports = {
	Session: Session,
}
