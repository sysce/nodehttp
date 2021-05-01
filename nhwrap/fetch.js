'use strict';
// basic fetch implementation, not intended for compressed data

var http = require('http'),
	https = require('https'),
	Headers = require('./headers');

class ClientResponse {
	constructor(req, res){
		this.headers = new Headers(res.headers);
		
		this._res = res;
		this._req = req;
		
		this.buf = req.method.toLowerCase() == 'HEAD' ? Promise.resolve(Buffer.from('')) : new Promise((resolve, reject, chunks = []) => res.on('data', chunk => chunks.push(chunk)).on('end', () => resolve(Buffer.concat(chunks))));
	}
	get status(){
		return this._res.statusCode;
	}
	async _buffer(method){
		if(!this.buf)throw new TypeError(`Failed to execute '${method}' on 'Response': body stream already read`)
		
		var buffer = await this.buf;
		
		delete this.buf;
		
		return buffer;
	}
	buffer(){
		return this._buffer('buffer');
	}
	async arrayBuffer(){
		var buffer = await this._buffer('arrayBuffer');
		
		return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
	}
	async text(){
		return (await this._buffer('text')).toString();
	}
	async json(){
		return JSON.parse((await this._buffer('json')).toString());
	}
};

module.exports = (url, opts = {}) => {
	var body = opts.body;
	
	opts = Object.assign({}, opts);
	
	url = new URL(url);
	
	opts.path = url.href.substr(url.origin);
	opts.hostname = url.hostname;
	opts.protocol = url.protocol;
	
	if(opts.headers instanceof Headers)opts.headers = Object.fromEntries([...Object.entries(opts.headers)]);
	
	if(body)delete opts.body;
	
	return new Promise((resolve, reject, req = (url.protocol == 'https:' ? https : http).request(opts, res => resolve(new ClientResponse(req, res)))) => req.on('error', reject).on('error', reject).end(body));
};