var express = require('express');
var router = express.Router();
const Bpmn = require('bpmn-engine');
const EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var sqlite = require('sqlite-sync');

router.get('/new', function(req, res, next) {
    
    
    var processXml = ``;

    fs.readFile("./process/hh.bpmn", function(err,data)
    {
        if(err)
            console.log(err)
        else{
            processXml=data.toString();
            const engine = new Bpmn.Engine({
                name: 'execution example',
                source: processXml,
                moddleOptions: {
                    camunda: require('camunda-bpmn-moddle/resources/camunda')
                }
            });
            const idp = Math.floor(Math.random() * 10000);

            sqlite.connect('myDatabase.db');

            var state = null;
            
            const listener = new EventEmitter();
            
            listener.once('start', (activity) => {
                console.log(activity.id);
                //engine.stop();
                state = engine.getState();

                fs.writeFile("./logs/inicio"+Date.now(), JSON.stringify(state), function(err) {
                    if(err) {
                        return console.log(err);
                    }
                }); 

                sqlite.run('INSERT INTO BPMPROCESS(ID,PROCESSSTATE) VALUES(?,?)',[idp, JSON.stringify(state)],function(err){
                    console.log(err);
                });

                console.log('Bpmn definition definition started with id', idp);
                res.redirect("/");
                console.log('completed');
            });
            

            engine.execute({
            listener: listener
            }, (err, execution) => {
                if (err) throw err;
            });

        }
    });
  });
  
  
  router.get('/delete/:id', function(req, res, next) {
    var idp = req.params.id;
    sqlite.connect('myDatabase.db');
    var rows = sqlite.run("DELETE FROM BPMPROCESS WHERE ID = ?", [idp]);
    res.redirect("/");
  });


  router.get('/resume/:id/:approved?', function(req, res, next) {
    var idp = req.params.id;
    var approved = req.params.approved;
    
    sqlite.connect('myDatabase.db');
    var rows = sqlite.run("SELECT * FROM BPMPROCESS WHERE ID = ?", [idp]);
    
    var state = JSON.parse(rows[0].PROCESSSTATE);
    
    //state = rows[0].PROCESSSTATE;
    
    Bpmn.Engine.resume(state,{moddleOptions: {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
        }},(err,newEngine) => {
        
        if (err) throw err;
        const listener = new EventEmitter();

        newEngine.once('end', () => {
            console.debug('FIM DO WORKFLOW OU STOP()');
            //LER https://github.com/paed01/bpmn-engine/issues/43
            console.log("SALVANDO NO BANCO");
            var newState = newEngine.getState();
            
            state.definitions = [];
            state.definitions.push(newState);

            fs.writeFile("./logs/salvo"+Date.now(), JSON.stringify(state), function(err) {
                if(err) {
                    return console.log(err);
                }
            }); 

            sqlite.run('UPDATE BPMPROCESS SET PROCESSSTATE = ? where ID = ?',[JSON.stringify(state),idp],function(err,rows){
                if (err) throw err;
            });
        });
        
        listener.on('start', (task, instance) => {
            console.debug('EVENTO start  ', task.id);
            
            if (task.type === 'bpmn:ExclusiveGateway') {
                
            }
        });
        /* Não utilizar
        listener.on('enter', (task, instance) => {
            console.debug('EVENTO enter  ', task.id);
            
        });*/
        /* Chamada assincrona, sugiro nao utilizar.
        listener.on('leave', (task) => {
            console.debug('leave  ', task.id);
            if (task.type === 'bpmn:UserTask') {
                
            }
            
        });*/
        listener.on('wait', (task,instance) => {
            console.log("EVENTO wait " + task.id);
            var inputoutput = task.activity.extensionElements.values[0];
            var flagcontinue = true;
            if(inputoutput['inputParameters'] != undefined){
                for(var i=0;i<inputoutput['inputParameters'].length;i++){
                    var item = inputoutput['inputParameters'][i];
                    if(item.name == "done" && item['value'] == "true"){
                        console.log("VARIAVEL DONE TRUE -> CONTINUANDO");
                        flagcontinue = false;
                        instance.signal(task.id);
                    }
                }
            }
            if(flagcontinue){
                if (task.type === 'bpmn:UserTask') {
                    console.log("TASK EM WAIT - " + task.id);
                    if (approved != undefined) {

                        if(inputoutput['inputParameters'] != undefined){

                            for(var i=0;i<inputoutput['inputParameters'].length;i++){
                                var item = inputoutput['inputParameters'][i];
                                if(item.name == "done"){
                                    item.value = "true";
                                }
                            }
                        }
                        if(inputoutput['outputParameters'] != undefined){

                            for(var i=0;i<inputoutput['outputParameters'].length;i++){
                                var item = inputoutput['outputParameters'][i];
                                if(item.name == "aprovacao"){
                                        
                                    if(approved == "true"){
                                        console.log("APROVADO " + approved);
                                        item.value = '${true}';
                                    }else{
                                        console.log("APROVADO " + approved);
                                        item.value = '${false}';
                                    }
                                }
                            }
                        }
                    }   
                    var retorno = instance.signal(task.id);
                    console.log("RETORNO SIGNAL"+ retorno);
                    newEngine.stop();

                    
                }
            }
        });
        listener.on('end', (task, instance) => {
            console.debug('EVENTO end  ', task.id);
            if(task.activity.extensionElements != undefined){
            }
        });
        listener.on('error', (err, eventSource) => {
            console.debug('EVENTO error ', err);
        });
        
        newEngine.execute({
            listener: listener
        }, (err, instance) => {
            console.log("RODANDO PROCESSO...");
            if (err) throw err;
           
        });
    });
    
    res.redirect("/");
  });


module.exports = router;