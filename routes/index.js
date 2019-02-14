var express = require('express');
var router = express.Router();

var sqlite = require('sqlite-sync');
sqlite.connect('myDatabase.db');


/* GET home page. */
router.get('/', function(req, res, next) {
  var rows = sqlite.run("SELECT * FROM BPMPROCESS");
  var process = [];
  rows.forEach(function(item) {
    process.push({
      ID : item.ID,
      PROCESSSTATE : item.PROCESSSTATE
    });
  });
  res.render('index', { title: 'Express' , rowsdata : process});
});

 

module.exports = router;
