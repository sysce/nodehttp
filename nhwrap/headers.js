'use strict';

/**
* Headers implementation
*/
class Headers extends Map {
	/**
	* Creates headers
	* @param {Object|Headers} [headers] - Pre-existing headers that will be parsed
	*/
	constructor(headers){
		super();
		
		if(typeof headers == 'object')for(var header in headers)this.set(header, headers[header]);
	}
	/**
	* Retrieves a header
	* @param {String} header
	* @returns {String}
	*/
	get(header){
		if(!super.has(header = this.normal_header(header)))return null;
		
		return [].concat(super.get(header)).join(', ');
	}
	/**
	* Retrieves header values (by set or append)
	* @see https://github.com/whatwg/fetch/issues/973
	* @param {String} header
	* @returns {Array}
	*/
	getAll(header){
		if(!super.has(header = this.normal_header(header)))return null;
		
		return [].concat(super.get(header));
	}
	/**
	* Determines if specified key exists or not
	* @param {String} header
	* @returns {Boolean}
	*/
	has(header){
		return super.has(this.normal_header(header));
	}
	/**
	* Removes specified header
	* @param {String} header
	* @returns {Boolean} - If deleting was successful
	*/
	delete(header){
		return super.delete(this.normal_header(header));
	}
	/**
	* Sets or updates a header
	* @param {String} header
	* @param {String} value
	*/
	set(header, value){
		if(Array.isArray(value))value.forEach(data => this.append(header, data));
		else super.set(this.normal_header(header), this.normal_value(value));
	}
	/**
	* Sets or appends to a header
	* @param {String} header
	* @param {String} value
	*/
	append(header, value){
		header = this.normal_header(header);
		value = this.normal_value(value);
		
		if(this.has(header)){
			var old_value = super.get(header);
			
			super.set(header, (Array.isArray(old_value) ? old_value : [ old_value ]).concat(value));
		}else super.set(header, value);
	}
	/**
	* Executes a function provided once per pair
	* @param {String} callback
	* @param {Object} thisArg
	*/
	forEach(callback, thisArg){
		for(var [ header, value ] of super.keys())callback.call(thisArg || this, this.get(header), header, this);
	}
	* entries(){
		for(var header of super.keys())yield [ header, this.get(header) ];
	}
	* entriesAll(){
		for(var header of super.keys())yield [ header, this.getAll(header) ];
	}
	* values(){
		for(var header of super.keys())yield this.get(header);
	}
	normal_header(header){
		if(typeof header != 'string')throw new TypeError('`header` must be a string');
		
		return header.toLowerCase();
	}
	normal_value(value){
		if(Array.isArray(value))return value.map(this.normal_value);
		
		return value; // [...value.toString().trim()].filter(x => x.charCodeAt()).join('');
	}
};

module.exports = Headers;