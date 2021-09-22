
const EventEmitter = require("events");
const got = require("got");


module.exports=class GatherClientBase extends EventEmitter{

	constructor(credentials, config, cb){

		super();
		this.renewAt=-1;
		this.config=config;
		this._connect(credentials, cb);

	}


	_connect(credentials, cb){

		this._login(credentials).then((token)=>{
			cb();
		});

	}


	_updateToken(token){

		this.renewAt=(new Date()).getTime()+token.expires
		this.token=token.token;
		this.renewalToken=token.renew;
	}


	async _login(credentials){
	
		const response = await got.post(this.config.url+'login',{
			form:{json:JSON.stringify(credentials)}
		}).json()


		if(!response.success){
			throw JSON.stringify(response);
		}
		this._updateToken(response.access_token);

	}

	_needsRenew(){
		return this.renewAt-(new Date()).getTime()<60;
	}

	async _renew(){


		const response = await this._request('renew',{
			plugin: "Users",
			token: this.renewalToken
		});


		this._updateToken(response.access_token);
	}


	async _request(task, json){

		if(this._needsRenew()){
			await this._renew();
		}

	
		const response = await got.post(this.config.url+task+"&iam="+this.config.iam+"&access_token="+this.token,{form:{json:JSON.stringify(json)}}).json()

		if(!response.success){
			throw JSON.stringify(response);
		}
		//console.log(response)
		return response;

	
	}

	_gatherRequest(task, json){

		json.plugin=this.config.plugin;

		return this._request(task, json);

	}


}

