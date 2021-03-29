var nodehttp = require('.'),
	server = new nodehttp.server({ log_ready: true });

server.use(nodehttp.static('public', { listing: [ '/images' ] }));