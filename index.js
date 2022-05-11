//kodiranje 
const CryptoJS = require('crypto-js');
const { Buffer } = require('buffer');
var crypto = require("crypto");
//dowloadanje 
const httpDowload = require('http');

//argumenti s 
var args = process.argv.slice(2);
console.log(args);
const port = args[0];
const p2p_port = args[1];

//P2P server 
var s_p2p_server = require('http').createServer();
var s_p2p_io = require('socket.io')(s_p2p_server);
var s_p2p = require('socket.io-p2p-server').Server;
s_p2p_io.use(s_p2p);
s_p2p_server.listen(p2p_port);


//P2P client 
var P2P = require('socket.io-p2p');
var c_p2p_io = require('socket.io-client');
//tracking p2p clients secrets
var p2p_secrets = new Map();
//Server
const express = require('express');
const app = express(); // ustvarimo express aplikacijo za usmerjanje http zahtev 
const http = require('http').Server(app);
const io = require('socket.io')(http);
//prenos datotek
const SocketIOFile = require('socket.io-file');



//keys -> na zacetku generiramo kljuce
var key = {
    client: crypto.getDiffieHellman('modp15'),
    server: crypto.getDiffieHellman('modp15')
}
key.client.generateKeys();
key.server.generateKeys();

//branje datotek
const fs = require('fs')

function encriptfile(file, key) {
    console.log("key in encript filr ---------------------------- " + key);
    var data1 = fs.readFileSync("data/" + file);
    var enc = CryptoJS.AES.encrypt(data1.toString('hex'), key);
    var data2 = Buffer.from(enc.toString(), 'utf-8');
    var filename = file.replace('.', '_');
    var newname = "enc" + filename + ".encrypted";
    console.log(newname);
    fs.writeFileSync('encripted/' + newname, data2);
    return newname;

}
function decriptfile(file, key) {
    console.log(key);
    var data1 = fs.readFileSync("download/" + file);
    var dec = CryptoJS.AES.decrypt(data1.toString("utf-8"), key);
    var data2 = Buffer.from(dec.toString(CryptoJS.enc.Utf8), 'hex');
    var name = file.substring(3);
    var array = name.split(".");
    array = array[0].split("_");
    fs.writeFileSync('decripted/' + array[0] + "." + array[1], data2);
    return array[0] + "." + array[1];
}

async function dowloadfile(link, name, secret, socket) {
    const file = fs.createWriteStream("download/" + name);
    console.log("link ------------> -----------------> " + link);
    httpDowload.get(link, function (response) {
        console.log(response);
        response.pipe(file);
        file.on('finish', function () {
            var down_name = decriptfile(name, secret);

            app.get('/' + down_name, (req, res) => {
                res.sendFile(__dirname + '/decripted/' + down_name);
            });
            var down_link = "http://localhost:" + port + "/" + down_name;
            var package = {
                link: down_link,
                name: down_name
            }
            console.log("socket_emit");
            socket.emit("dowload-link", package);
        });
    })

    //});

}

//vzpostavimo spletno stran, ob requestu HTTP GET
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});
app.get('/lol', (req, res) => {
    res.sendFile(__dirname + '/test.jpg');
});


app.get('/socket.io.js', (req, res, next) => {
    return res.sendFile(__dirname + '/node_modules/socket.io-client/dist/socket.io.js');
});

app.get('/socket.io-file-client.js', (req, res, next) => {
    return res.sendFile(__dirname + '/node_modules/socket.io-file-client/socket.io-file-client.js');
});

//spremeni gumbe za dowloadanje direktno na clientu 

//server povezave
io.on('connection', (socket) => {
    try {
        var count = 0;
        //dowloadanje datoteke iz aplikacije odjemalca
        var uploader = new SocketIOFile(socket, {
            // uploadDir: {			// multiple directories
            // 	music: 'data/music',
            // 	document: 'data/document'
            // },
            uploadDir: 'data',							// simple directory
            // accepts: ['audio/mpeg', 'audio/mp3'],		// chrome and some of browsers checking mp3 as 'audio/mp3', not 'audio/mpeg'
            // maxFileSize: 4194304, 						// 4 MB. default is undefined(no limit)
            chunkSize: 10240,							// default is 10240(1KB)
            transmissionDelay: 0,						// delay of each transmission, higher value saves more cpu resources, lower upload speed. default is 0(no delay)
            overwrite: false, 							// overwrite file if exists, default is true.
            // rename: function(filename) {
            // 	var split = filename.split('.');	// split filename by .(extension)
            // 	var fname = split[0];	// filename without extension
            // 	var ext = split[1];

            // 	return `${fname}_${count++}.${ext}`;
            // }
            //rename: 'pic.jpg'
        });
        uploader.on('start', (fileInfo) => {
            console.log('Start uploading');
            console.log(fileInfo);
        });
        uploader.on('stream', (fileInfo) => {
            console.log(`${fileInfo.wrote} / ${fileInfo.size} byte(s)`);
        });
        uploader.on('error', (err) => {
            console.log('Error!', err);
        });
        uploader.on('abort', (fileInfo) => {
            console.log('Aborted: ', fileInfo);
        });
        //////////////////////////////////////////////////////////////
        //p2p
        socket.on("p2p", async (msg) => {
            var secret;
            console.log("p2p --------------------------");
            console.log("message-> " + msg);
            //izpostavi se povezava
            var c_p2p_socket = c_p2p_io("http://localhost:" + msg);
            var c_p2p = new P2P(c_p2p_socket);

            c_p2p.emit("public", key.client.getPublicKey());
            c_p2p.on('r_public', function (msg) {
                console.log("public key recieved");
                secret = key.client.computeSecret(msg, null, 'hex');
                console.log("secret= " + secret);
                socket.emit("message", "key exanged");
            });
            c_p2p.emit("message", "hello");
            c_p2p.emit("message",);
            c_p2p.on('reply', function (msg) {
                console.log(msg);
            });
            //complete
            uploader.on('complete', (fileInfo) => {
                console.log('Upload Complete.');
                console.log(fileInfo);
                var newname = encriptfile(fileInfo.name, secret);
                app.get('/' + newname, (req, res) => {
                    res.sendFile(__dirname + '/encripted/' + newname);
                });
                console.log("------>" + newname);
                var package = {
                    filename: newname,
                    link: "http://localhost:" + port + "/" + newname
                }
                c_p2p.emit("dowload", package);
            });
            socket.on('disconnect', function () { // ko se user disonecta iz nasega serverja
                io.emit('message', 'A user disconnected');
                c_p2p_socket.disconnect();
                c_p2p.disconnect();
            });
            socket.on('disconnect_p2p', function () {
                socket.emit('message', 'A user disconnected');
                c_p2p_socket.disconnect();
                c_p2p.disconnect();
            })
        })

        //p2p server-----------------------------------------
        s_p2p_io.on('connection', (p2p_socket) => {
            //trackanje id-jevi map
            //var secret;
            try {
                socket.emit("message", "P2P connceted");
                console.log("P2P connceted");


                p2p_socket.on("message", (msg) => {
                    socket.emit('message', msg);
                    p2p_socket.emit('reply', "Connection succesful");
                });
                p2p_socket.on("public", (p_key) => {
                    var secret = key.server.computeSecret(p_key, null, 'hex');
                    console.log("secret= " + secret);
                    console.log("socket id ->>>>>>>>>>>>>>>" + p2p_socket.id);
                    p2p_secrets.set(p2p_socket.id, secret);
                    p2p_socket.emit("r_public", key.server.getPublicKey())
                });
                p2p_socket.on("dowload", (package) => {
                    console.log("socket emit dowload");
                    package.socket_id = p2p_socket.id;
                    console.log(p2p_secrets);
                    dowloadfile(package.link, package.filename, p2p_secrets.get(p2p_socket.id), socket);
                    //socket.emit("dowload", package);
                });

                /* socket.on("dowload-command", function (package) {
                     var filename = package.filename;
                     console.log(p2p_secrets.get(package.socked_id));
     
                 });*/
                p2p_socket.on('disconnect', function () { // ko se user disonecta iz nasega serverja
                    console.log('P2P user disconnected');
                    socket.emit('message', 'P2P user disconnected');
                });
            } catch (e) {
                console.log(e);
            }
        });


        console.log("a user connected")
        socket.on('disconnect', function () { // ko se user disonecta iz nasega serverja
            console.log('A user disconnected');
            io.emit('message', 'A user disconnected');

        });
    } catch (error) {
        console.log(error);
    }

});

http.listen(port, () => { // funkcija  listening server caka na povezavo 
    console.log('listening on: ' + port);
});


