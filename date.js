// date utilities
'use strict';

exports.days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
exports.months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
* Makes a parsable GMT string for the client 
* @param {Date|Number} Date
* @returns {String}
*/

exports.format = date => {
	if(typeof date == 'number')date = new Date(date);
	
	var day_name = exports.days[date.getUTCDay()],
		month = exports.months[date.getMonth()],
		timestamp = [ date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds() ].map(num => (num + '').padStart(2, 0)).join(':'),
		day = (date.getUTCDate() + '').padStart(2, 0),
		year = date.getUTCFullYear();
	
	// <day-name>, <day> <month> <year> <hour>:<minute>:<second> GMT
	return day_name + ', ' + day + ' ' + month + ' ' + year + ' ' + timestamp + ' GMT';
};

/**
* Parses a client date eg if-modifed-since
* @param {String} Header
* @returns {Date}
*/

exports.parse = date => {
	if(typeof date == 'number')return new Date(date);
	if(date instanceof Date)return date;
	
	var [ day_name, day, month, year, timestamp, timezone ] = date.split(' '),
		[ hours, minutes, seconds ] = (timestamp || '').split(':').map(num => parseInt(num)),
		out = new Date();
	
	out.setUTCMonth(exports.months.indexOf(month));
	out.setUTCDate(day);
	out.setUTCFullYear(year);
	out.setUTCHours(hours);
	out.setUTCMinutes(minutes);
	out.setUTCSeconds(seconds);
	
	out.setUTCMilliseconds(0);
	
	return out;
};

/**
* Compares if date 1 is greater than date 2
* @param {String|Date} Date 1
* @param {String|Date} Date 2
* @returns {Date}
*/

exports.compare = (date1, date2) => {
	var date1 = exports.parse(date1),
		date2 = exports.parse(date2);
	
	
	date1.setUTCMilliseconds(0);
	date2.setUTCMilliseconds(0);
	
	return date1.getTime() > date2.getTime();
};

exports.time = {
	second: 1000,
	minute: 1000 * 60,
	hour: 1000 * 60 * 60,
	day: 1000 * 60 * 60 * 24,
	month: 1000 * 60 * 60 * 25 * 30,
	year: 1000 * 60 * 60 * 24 * 365,
};