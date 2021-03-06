[![Stories in Ready](https://badge.waffle.io/OpenBCI/openbci-js-sdk.png?label=ready&title=Ready)](https://waffle.io/OpenBCI/openbci-js-sdk)
[![Join the chat at https://gitter.im/OpenBCI/openbci-js-sdk](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/OpenBCI/openbci-js-sdk?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

#openbci-sdk

An NPM module for OpenBCI

##Working with the Module

Initialization
--------------

Initializing the board:

```js
var OpenBCIBoard = require('openbci-sdk');
var ourBoard = new OpenBCIBoard.OpenBCIBoard();
```

'ready' event
-----------

You MUST wait for the 'ready' event to be emitted before streaming/talking with the board. The ready happens asynchronously 
so installing the 'sample' listener and writing before the ready event might result in... nothing at all.

```js
var ourBoard = new require('openbci-sdk').OpenBCIBoard();
ourBoard.boardConnect(portName).then(function(boardSerial) {
    ourBoard.on('ready',function() {
        /** Start streaming, reading registers, what ever your heart desires  */
    });
}).catch(function(err) {
    /** Handle connection errors */
});            
```

Samples
-------
The power of this module is in using the sample emitter, to be provided with samples to do with as you wish.

To actually get a sample you need to
1. Start streaming
2. Install the 'sample' event emitter

```js
var ourBoard = new require('openbci-sdk').OpenBCIBoard();
ourBoard.boardConnect(portName).then(function(boardSerial) {
    ourBoard.on('ready',function() {
        ourBoard.streamStart();
        ourBoard.on('sample',function(sample) {
            /** Work with sample */
        });
    });
}).catch(function(err) {
    /** Handle connection errors */
});            
```
A sample is an object that has the following properties:
1. startByte (number)
2. sampleNumber (number)
3. channelData (channel data indexed starting at 1 [1,2,3,4,5,6,7,8])
4. auxData (aux data indexed starting at 0 [0,1,2])
5. stopByte

Auto-finding boards
-------------------
You must have the OpenBCI board connected to the PC before trying to automatically find it.

If a port is not automatically found, then a list of ports will be returned, this would be a 
good place to present a drop down picker list to the user, so they may manually select the 
serial port name.

```js
var ourBoard = new require('openbci-sdk').OpenBCIBoard();
ourBoard.autoFindOpenBCIBoard(function(portName,ports) {
    if(portName) {
        /** 
        * Connect to the board with portName
        * i.e. ourBoard.boardConnect(portName).....
        */

    } else {
        /** Display list of ports */
        console.log('Port not found... check ports for other ports');
    }
});
```


##Dev Notes
Running
-------
1. Plug usb module into serial port
2. Turn OpenBCI device on
3. Type `npm start` into the terminal in the project directory

Testing
-------
```
npm test
```
