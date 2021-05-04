'use strict';

/**
* Headers implementation
*/
class Headers {
	/**
	* Creates headers
	* @param {Object|Headers} [headers] - Pre-existing headers that will be parsed
	*/
	constructor(data = {}){
		this.data = data;
	}
	/**
	* Retrieves a header
	* @param {String} header
	* @returns {String}
	*/
	get(header){
		if(!this.has(header))return null;
		
		return [].concat(this.data[this.normal_header(header)]).join(', ');
	}
	/**
	* Retrieves header values (by set or append)
	* @see https://github.com/whatwg/fetch/issues/973
	* @param {String} header
	* @returns {Array}
	*/
	getAll(header){
		if(!this.has(header))return null;
		
		return [].concat(this.data[this.normal_header(header)]);
	}
	/**
	* Determines if specified key exists or not
	* @param {String} header
	* @returns {Boolean}
	*/
	has(header){
		return this.data.hasOwnProperty(this.normal_header(header));
	}
	/**
	* Removes specified header
	* @param {String} header
	* @returns {Boolean} - If deleting was successful
	*/
	delete(header){
		return delete this.data[this.normal_header(header)];
	}
	/**
	* Sets or updates a header
	* @param {String} header
	* @param {String} value
	*/
	set(header, value){
		if(Array.isArray(value))value.forEach(data => this.append(header, data));
		else this.data[this.normal_header(header)] = this.normal_value(value);
	}
	/**
	* Sets or appends to a header
	* @param {String} header
	* @param {String} value
	*/
	append(header, value){
		value = this.normal_value(value);
		
		if(!this.has(header))return this.set(header, value);
		
		this.data[header = this.normal_header(header)] = [].concat(this.data[header], this.normal_value(value));
	}
	/**
	* Executes a function provided once per pair
	* @param {String} callback
	* @param {Object} thisArg
	*/
	forEach(callback, thisArg){
		for(var [ header, value ] of this.keys())callback.call(thisArg || this, this.get(header), header, this);
	}
	* keys(){
		for(var prop in this.data)yield prop;
	}
	* entries(){
		for(var header of this.keys())yield [ header, this.get(header) ];
	}
	* entriesAll(){
		for(var header of this.keys())yield [ header, this.getAll(header) ];
	}
	* values(){
		for(var header of this.keys())yield this.get(header);
	}
	[Symbol.iterator](){
		return this.entries();
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