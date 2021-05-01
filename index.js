// nodehttp
'use strict';
var fs = require('fs'),
	tls = require('tls'),
	net = require('net'),
	path = require('path'),
	util = require('util'),
	http = require('http'),
	https = require('https'),
	events = require('events'),
	reader = require('./reader'),
	WebSocketRequest = require('./lib/WebSocketRequest');

class Request extends events {
	constructor(server, data){
		super();
		
		this.headers = data.headers;
		this.server = server;
		this.method = data.method;
		this.version = data.http;
		this.protocol = data.encrypted ? 'https:' : 'http';
		this.secure = this.protocol == 'https:';
		this.ip = data.remoteAddress;
		this.body = data.body;
		
		var trust_proxy = this.server.config['trust-proxy'];
		
		if(this.version == 1.1)this.connection = this.headers.connection;
		
		this.forwarded = {
			host: this.headers['host'] || 'unknown',
			ips: [],
			protocol: this.protocol,
			trust: this.server.config.trust_proxy.map(ip => Request.proxy_preset.hasOwnProperty(ip) ? Request.proxy_preset[ip] : ip).includes(this.ip),
		};
		
		// if proxy is trusted, process forwarded headers
		if(this.forwarded.trust){
			if(this.headers['x-forwarded-for'])this.forwarded.ips = this.headers['x-forwarded-for'].split(', '), this.forwarded.ip = this.forwarded.ips[0];
			
			if(this.headers['x-forwarded-proto'])this.forwarded.protocol = this.headers['x-forwarded-proto'];
			
			if(this.headers['x-forwarded-host'])this.forwarded.host = this.headers['x-forwarded-host'];
		}
		
		this.url = new URL(data.url.replace(/[\/\\]+/g, '/'), 'http' + (this.secure ? 's' : '') + '://' + this.forwarded.host);
		
		if(this.headers['content-type'])switch(this.headers['content-type'].split(';')[0]){
			case'text/plain':
				
				this.body = this.body.toString();
				
				break;
			case'application/json':
				
				try{
					this.body = JSON.parse(this.body);
				}catch(err){
					this.body = {};
				}
				
				break;
			case'application/x-www-form-urlencoded':
				
				this.body = Object.fromEntries([...new URLSearchParams(this.body.toString()).entries()]);
				
				break;
		}
	}
};

class Response extends events {
	constructor(request, socket){
		super();
		
		this.socket = socket;
		
		this.request = request;
		
		// not required or used in any other function
		this.headers = {};
		
		this.version = this.request.version;
		
		this[reader.http_impl] = {
			status: 200,
			message: 'OK',
		}
		
		if(this.version == 1.1){
			this.headers['transfer-encoding'] = this[reader.http_impl].transfer_encoding = 'chunked';
			this.headers.connection = this[reader.http_impl].connection = 'keep-alive';
			this.headers['keep-alive'] = 'timeout=' + (this.request.server.config.keep_alive.timeout / 1000);
		}else if(this.version == 1)this.write_buffers = [];
	}
	write_head(status, headers){
		if(this.head_sent)throw new Error('Response headers already sent');
		this.head_sent = true;
		
		this[reader.http_impl].connection = headers.connection;
		this[reader.http_impl].content_length = headers['content-length'];
		this[reader.http_impl].transfer_encoding = headers['transfer-encoding'];
		
		this.socket.write(`HTTP/${this.version == 1 ? '1.0' : '1.1'} ${status} ${this[reader.http_impl].message}\r\n${Object.entries(headers).map(([ header, value ]) => [].concat(value).map(value => header + ': ' + value + '\r\n').join('')).join('')}\r\n`);
	}
	status(code, message){
		if(reader.status_codes[code]){
			this[reader.http_impl].status = parseInt(code);
			this[reader.http_impl].message = message || reader.status_codes[this[reader.http_impl].status];
		}else throw new Error('Invalid status');
	}
	error(code, message, title = code){
		if(!message)title = code + ' ' + reader.status_codes[code];
		
		this.status(code);
		this.headers['content-type'] = 'text/html';
		
		if(message){
			var formatted = util.format(message);
			
			if(message instanceof Error)formatted = '<pre>' + formatted + '</pre>';
			
			this.end(`<!doctype html><html><head><title>${code} ${message=reader.status_codes[code]}</title></head><body><h1>${code} ${message}</h1><hr><p>${formatted}</p></body></html>`);
		}else this.end(`<!doctype html><html><head><title>${code} ${message=reader.status_codes[code]}</title></head><body><center><h1>${code} ${message}</h1><hr>nodehttp</center></body></html>`);
	}
	// intended to be overwritten by wrapper, return an object
	wrapped_headers(){
		return this.headers;
	}
	write(data){
		if(this.body_sent)throw new Error('Response ended');
		if(!this.head_sent)this.write_head(this[reader.http_impl].status, this.wrapped_headers());
		
		if(typeof data != 'string' && !Buffer.isBuffer(data))throw new TypeError('Data must be a string or buffer');
		else if(!Buffer.byteLength(data))return this;
		
		// chunked closes on first empty write, make sure written data is not empty
		if(this.version == 1.1){
			var send = Buffer.from(data);
			
			if(this[reader.http_impl].transfer_encoding == 'chunked')send = Buffer.concat([ Buffer.from(send.byteLength.toString(16) + '\r\n'), send, Buffer.from(`\r\n`) ]);
			
			this.socket.write(send);
		}else if(this.version == 1)this.write_buffers.push(data);
	}
	end(data){
		if(!this.head_sent)this.write_head(this[reader.http_impl].status, this.wrapped_headers());
		if(typeof data != 'undefined')this.write(data);
		
		if(this.version == 1.1){
			
			if(
				this[reader.http_impl].connection != 'keep-alive' ||
				this.request.connection != 'keep-alive'
			)this.socket.end();
			else if(this[reader.http_impl].transfer_encoding == 'chunked')this.socket.write('0\r\n\r\n');
			else if(this[reader.http_impl].content_length == null)throw new Error('No content-length specified');
			
			this.body_sent = true;
		}else if(this.version = 1){
			this.write(data);
			
			var write = Buffer.concat(this.write_buffers.map(data => Buffer.from(data)));
			
			delete this.write_buffers;
			
			this.headers.set('content-length', write.byteLength);
			
			if(!this.head_sent)this.write_head(this[reader.http_impl].status, this.headers);
			
			this.socket.end(write);
		}
		
		this.emit('end');
	}
}

class HTTPNativeRequest {
	
};

class HTTPExpressRequest {
	
};

class HTTPExpressResponse {
	
};

HTTPNativeRequest.read_data = request => {
	var chunks = [],
		result = {
			headers: request.headers,
			url: request.url,
			method: request.method,
			errors: [],
		};
	
	return new Promise(resolve => {
		var end_listen = () => {
				result.body = Buffer.concat(chunks);
				chunks = null;
				resolve(result);
			},
			data_listen = chunk => {
				if(Buffer.concat(chunks).byteLength > 1e7){
					request.off('data', data_listen).off('end', end_listen);
					result.errors.push('Max body size (10 MB) exceeded');
					end_listen();
				}else chunks.push(chunk);
			};
		
		request.on('data', data_listen).once('end', end_listen)
	});
};

Request.proxy_preset = {
	loopback: [ '127.0.0.1/8', '::1/128' ],
	linklocal: [ '169.254.0.0/16', 'fe80::/10' ],
	uniquelocal: [ '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7' ],
};

class Router extends events {
	constructor(){
		super();
		
		this.routes = [];
		this.hosts = new Map();
		this.aliases = new Map();
	}
	/**
	* Route a request
	* @param {Object} res - Server response
	*/
	async route(request, response, index = 0, err){
		for(var [ host, router ] of this.hosts.entries())if(host == '*' || host instanceof RegExp && host.test(req.url.hostname) || host == request.url.hostname)return router.route(response);
		
		var is_ws = request.method == 'GET' && request.headers['connection'] == 'Upgrade',
			req_method = is_ws ? 'WS' : request.method,
			end = this.routes.slice(index).findIndex(route => {
				if(is_ws && route.method != 'WS')return;
				else if(route.method != '*' && route.method != req_method && (req_method != 'HEAD' || route.method != 'GET'))return;
				else return test_strex(request.url, route.path, route.type);
			}),
			next = err => {
				if(this.body_sent)return;
				// if(err instanceof Error)console.error(err);
				// console.log(end, this.routes.slice(end + 1).length == this.routes.slice(ind).length);
				return this.route(request, response, index + 1, err);
			};
		
		if(end != -1)end += index;
		
		if(this.routes[end]){
			request.route = this.routes[end];
			
			try{
				if(is_ws){
					var ws_req = new WebSocketRequest(response.socket, {
						headers: Object.fromEntries([...request.headers.entriesAll()]),
						url: request.url,
					}, { assembleFragments: true });
					
					ws_req.readHandshake();
					
					var connection = ws_req.accept();
					
					connection.on('message', data => request.emit('message', data.type == 'utf8' ? Buffer.from(data.utf8Data) : data.binaryData));
					connection.on('close', request.emit.bind(request, 'close'));
					connection.on('drain', request.emit.bind(request, 'drain'));
					connection.on('pause', request.emit.bind(request, 'pause'));
					connection.on('resume', request.emit.bind(request, 'resume'));
				}
				
				var wrap_req = new this.routes[end].wrap.request(request),
					wrap_res = new this.routes[end].wrap.response(response);
				
				wrap_res.request = wrap_req;
				wrap_req.response = wrap_res;
				
				await this.routes[end].callback(wrap_req, wrap_res, next);
			}catch(err){
				console.error('nodehttp caught:');
				console.error(err);
				next(err);
			}
		}else if(!response.body_sent && !response.head_sent)response.error(404);
	}
	/**
	* An internal redirect
	* @param {String} path
	* @param {String} alias
	*/
	alias(path, alias){
		this.aliases.set(path, alias);
		
		return this;
	}
	/**
	* Create routes to a host
	* @param {String} Host
	* @param {Function} [callback]
	* @returns {Router} Router
	*/
	host(host, callback){
		var route = new router();
		
		this.hosts.set(string_or_regex(host), route);
		
		if(typeof callback == 'function')callback(route);
		
		return route;
	}
}

class NativeResponseInterface extends Response {
	constructor(request, response){
		super(request, response);
	}
	write_head(status, headers){
		if(this.head_sent)throw new Error('Response headers already sent');
		this.head_sent = true;
		
		this.socket.writeHead(status, headers);
	}
	write(data){
		if(this.body_sent)throw new Error('Response ended');
		if(!this.head_sent)this.write_head(this[reader.http_impl].status, this.headers);
		
		this.socket.write(data);
	}
	end(data){
		if(this.body_sent)throw new Error('Response ended');
		if(!this.head_sent)this.write_head(this[reader.http_impl].status, this.headers);
		this.body_sent = true;
		
		this.socket.end(data);
	}
};

var make_regex = (path, flags) => new RegExp(path.replace(/[[\]\/()$^+|.?]/g, char => '\\' + char).replace(/\*/g, '.*?'), flags),
	string_or_regex = (input, meta) => input != '*' ? meta == 'USE' ? (input instanceof RegExp ? new RegExp(input.source + '*', input.flags) : make_regex(input + '*')) : input.includes('*') ? make_regex(input) : input : input,
	test_strex = (input, match, meta) => {
		if(!match || match == '*')return true;
		
		if(meta == 'USE')match = match instanceof RegExp ? new RegExp(match.source + '*', match.flags) : make_regex(match + '*');
		
		if(match instanceof RegExp)return match.test(input);
		if(match.includes('*'))return make_regex(match).test(input);
		
		return match == input;
	};

// add routes
[ 'WS', [ 'USE', '*' ], [ 'ALL', '*' ] ].concat(reader.methods).forEach(data => {
	var name, method;
	
	if(Array.isArray(data))name = data[0], method = data[1];
	else name = method = data;
	
	Router.prototype[name.toLowerCase()] = function(...args){
		var callback = args.find(val => typeof val == 'function');
		
		if(!callback)throw new Error('Specify a callback');
		
		this.routes.push({
			method: method,
			type: name, // real type eg use
			path: args.find(val => typeof val == 'string' || val instanceof RegExp),
			callback: callback,
			wrap: args.find(val => typeof val == 'object') || exports.wrap.nodehttp,
		});
		
		return callback;
	};
});

/**
* Server
*/
class Server extends Router {
	/**
	* @param {Object} [config]
	* @param {Number} [config.port] - Port to listen on, by defualt if SSL is provided 443, otherwise 80
	* @param {String} [config.address] - IP address to listen on
	* @param {Boolean} [config.log] - If bound events should be logged
	* @param {Boolean} [config.debug] - If debug logs should show in console
	* @param {Boolean} [config.native] - If native modules such as http and https should be used rather than a custom implementation
	* @param {Array} [config.trust_proxy] - An array of proxies trusted with x-forwarded headers
	* @param {Object} [config.keep_alive] - keep-alive settings that apply if native is false
	* @param {Number} [config.keep_alive.timeout] - Timeout for sockets in MS
	* @param {Number} [config.keep_alive.requests] - Maximum requests per socket
	*/
	constructor(config = {}){
		super();
		
		this.debug_trace = [];
		
		this.config = Object.assign({
			address: '0.0.0.0',
			log: false,
			debug: false,
			trust_proxy: [],
			keep_alive: {
				timeout: 8000,
				requests: 75,
			},
			// determines if native modules such as http and https should be used
			// otherwise custom error tolerant implementation will be used
			native: true,
		}, config);
		
		if(this.config.log)this.once('bound', url => console.log(`Listening on ${url}`));
		
		this.ssl = typeof this.config.ssl == 'object' && this.config.ssl != null;
		
		this.config.port = +this.config.port || (this.ssl ? 443 : 80);
		
		this.server = new(this.config.native ? this.ssl ? https : http : this.ssl ? tls : net).Server(this.config.ssl, async (request, response) => {
			if(this.config.native){
				var request = new Request(this, await HTTPNativeRequest.read_data(request));
				
				this.route(request, new NativeResponseInterface(request, response));
			}else{
				var id = ~~(Math.random() * 1e7),
					timeout = setTimeout(() => {
						request.end();
						
						this.debug(id, 'Timed out, closed');
					}, this.config.keep_alive.timeout),
					requests = 0,
					data_cb = data => {
						if(requests++ > this.config.keep_alive.requests)return request.end(), this.debug(id, 'Max requests reached, closed');
						
						var data = reader.read_request(data, request);
						
						if(data.headers.connection != 'keep-alive')clearTimeout(timeout), request.off('data', data_cb);
						else clearTimeout(timeout), this.debug(id, 'Timeout paused');
						
						this.debug(id, 'Recieved data', `${data.method} ${data.url} HTTP/${data.http} ${data.headers.connection}`);
						
						var resp = new Response(new Request(this, data), request);
						
						resp.on('end', () => {
							timeout.refresh();
							this.debug(id, 'Response sent', 'Timeout refreshed');
						});
						
						this.route(resp.request, resp);
					};
				
				this.debug(id, 'Connected');
				
				request.on('error', err => this.debug(id, err));
				
				request.on('data', data_cb);
				
				request.on('close', () => {
					clearTimeout(timeout);
					
					this.debug(id, 'Closed');
				});
			}
		});
		
		this.server.listen(this.config.port, this.config.address, () => this.emit('bound', new URL('http' + (this.ssl ? 's' : '') + '://' + ('0.0.0.0' == this.config.address ? '127.0.0.1' : this.config.address) + (this.config.port && this.config.port != (this.ssl ? 443 : 80) ? ':' + this.config.port : ''))));
	}
	debug(id, ...data){
		this.debug_trace.splice(0, this.debug_trace.length - 5);
		this.debug_trace.push(data);
		if(this.config.debug)console.log('[' + id + ']', data.join(', '));
	}
}

exports.Request = Request;
exports.Response = Response;
exports.Router = Router;
exports.Server = Server;
exports.wrap = {
	nodehttp: require('./nhwrap'),
	express: { request: HTTPExpressRequest, response: HTTPExpressResponse },
	// native: { request: HTTPNativeRequest, response: HTTPNativeResponse },
};
exports.listing = exports.wrap.nodehttp.listing;
exports.static = exports.wrap.nodehttp.static;