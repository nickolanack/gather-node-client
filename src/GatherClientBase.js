const EventEmitter = require("events");
const got = require("got");
const SocketIO=require("push-node-socket-io-client");


module.exports = class GatherClientBase extends EventEmitter {

	constructor(credentials, config, cb) {

		super();

		if (config.ignoreCertError === true) {
			process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0
		}

		this._q=[];
		this._isRunningQueue=false;

		this._isRenewing=false;
		this.renewAt = -1;
		this.config = config;
		this._connect(credentials, cb);


	}


	_connect(credentials, cb) {

		this._login(credentials).then((token) => {
			cb();
		});

	}


	_updateToken(token) {

		this.renewAt = (new Date()).getTime() + (token.expires*1000) //JavaScript uses milliseconds as the unit of measurement, whereas Unix Time is in seconds.
		this.token = token.token;
		this.renewalToken = token.renew;
	}


	async _login(credentials) {

		const response = await got.post(this.config.url + 'login', {
			form: {
				json: JSON.stringify(credentials)
			}
		}).json()


		if (!response.success) {
			throw JSON.stringify(response);
		}
		this._updateToken(response.access_token);

	}

	_needsRenew() {
		return this.renewAt - (new Date()).getTime() < 60;
	}

	async _renew() {


		this._isRenewing=true;
		//console.log('renew');
		const response = await got.post(this.config.url + 'renew'+ "&iam=" + this.config.iam + "&access_token=" + this.token, {
			form: {
				json: JSON.stringify({
					plugin: "Users",
					token: this.renewalToken
				})
			}
		}).json();


		this._updateToken(response.access_token);
		this._isRenewing=false;
		this.emit('renew');
	}


	async _request(task, json) {

		

		
		// const response = await got.post(this.config.url + task + "&iam=" + this.config.iam + "&access_token=" + this.token, {
		// 	form: {
		// 		json: JSON.stringify(json)
		// 	}
		// }).json()
		// 
		
		const response = await this._post(this.config.url + task + "&iam=" + this.config.iam + "&access_token=" + this.token, {
			form: {
				json: JSON.stringify(json)
			}
		});


		if (!response.success) {
			throw JSON.stringify(response);
		}
		//console.log(response)
		return response;

		

	}


	_post(url, data){
		return new Promise((resolve, reject)=>{

			this._queue(async ()=>{
				const response = await got.post(url, data).json();
				resolve(response);
			});


		});
		
	}


	async _queue(fn){

		this._q.push(fn);

		if(this._isRunningQueue){
			return;
		}

		this._isRunningQueue=true;

		while(this._q.length>0){

			if ((!this._isRenewing)&&this._needsRenew()) {
				await this._renew().catch((e)=>{
					console.log("renew error");
					console.error(e);
				});
			}


			var _fn=this._q.shift();
			await _fn();


			

		}
		this._isRunningQueue=false;


	}


	_attributesRequest(task, json) {

		json.plugin = "Attributes";
		return this._request(task, json);

	}

	_gatherRequest(task, json) {

		json.plugin = this.config.plugin;
		return this._request(task, json);

	}

	_messageRequest(task, json) {

		if(typeof this.config.messagePlugin =="undefined"){
			throw "Requires config.messagePlugin";
		}

		json.plugin = this.config.discussionPlugin;
		return this._request(task, json);

	}

	getSocketInfo(){
		return this._request('get_socket_info',{
			plugin :"MessageSystem"
		}).then((response)=>{
			return response;
		});
	}


	subscribe(channel, event, cb){

		if(!this._socketclient){

			this.getSocketInfo().then((socketInfo)=>{
				console.log(socketInfo);
				this._socketclient=new SocketIO.SocketIOClient(socketInfo.socketUrl);
		
			});
			
		}

	}





}




