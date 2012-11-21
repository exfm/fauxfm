"use strict";

var express = require('express'),
	fs = require('fs');

var app = express(),
	fakeData = {};

// Load our fake data
fakeData = JSON.parse(fs.readFileSync(__dirname + '/fakedata.json', 'utf-8'));

app.get('/api/v3/user/:user/loved', function(req, res){
	var start = req.query.start || 0,
		results = req.query.results || 100,
		username = req.params.user;

	if (!fakeData.hasOwnProperty(username)){
		return res.send(404);
	}
	return res.json(getData(username, start, results));
});

function getData(username, start, results){
	var songs;
	if (start + results > fakeData[username].length){
		songs = fakeData[username].slice(start, fakeData[username].length - 1);
	}
	songs = fakeData[username].slice(start, start + results);
	return {
		'status_test': "OK",
		'status_code': 200,
		'results': songs.length,
		'start': start,
		'total': fakeData[username].length,
		'songs': songs
	};
}

app.listen(3000);
console.log('App listening on 3000');
console.log('Fake data:');
for (var key in fakeData){
	console.log(key);
}