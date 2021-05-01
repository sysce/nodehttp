// parsing executable files
'use strict';

var regex = /(<\?)|(\?>)|(\w+)|(\W)|(\r?\n)|[\s\S]/g,
	regex_meaning = [ 'exec_open', 'exec_exit', 'word', 'symbol', 'break' ],
	breakers = [ 'eof', 'exec_open' ],
	tokenize = string => {
		var tokens = [];
		
		string.replace(regex, (match, ...groups) => tokens.push([ regex_meaning[groups.findIndex(val => typeof val == 'string')] || 'unknown', match ]));
		
		tokens.push([ 'eof' ]);
		
		return tokens;
	};

module.exports = (string, source, handle_error) => {
	var tokens = tokenize(string),
		output = '"use strict";',
		state = [ 'echo', '', [] ];
	
	for(var token, ind = 0; !!(token = tokens[ind]); ind++)switch(state[0]){
		case'exec':
			
			if(!state[2])state[2] = token[1];
			else if(token[0] == 'exec_exit')output += state[2] == '=' ? 'echo(' + state[1] + ');' : state[1], state = [ 'echo', '', [] ];
			else state[1] += token[1];
			
			break;
		case'echo':
			
			if(breakers.includes(token[0])){
				state[2].push(state[1]), state[1] = '';
				
				var data = state[2].filter(str => str.length).map(str => JSON.stringify(str)).join('+\n');
				
				if(data.length)output += 'echo(' + data + ');';
				state[2] = '';
				if(token[0] == 'exec_open')state = [ 'exec', '' ];
			}else{
				state[1] += token[1];
				
				if(token[0] == 'break')state[2].push(state[1]), state[1] = '';
			}
			
			break;
	}
	
	return output + (source ? '//# sourceURL=' + source : '');
};