"use strict";

var express = require('express'),
	fs = require('fs');

var app = express(),
	fakeData = {};

// Load our fake data
fakeData = JSON.parse(fs.readFileSync(__dirname + '/ari_loved.json', 'utf-8'));

app.get('/api/v3/user/:user/loved', function(req, res){
	res.json(fakeData[req.params.user]);
});

app.listen(3000);
console.log('App listening on 3000');