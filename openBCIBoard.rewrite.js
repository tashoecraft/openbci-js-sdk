'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const stream = require('stream');
const Transform = stream.Transform;
const serialPort = require('serialport');
const openBCISample = require('./openBCISample');
const k = openBCISample.k;
const openBCISimulator = require('./openBCISimulator');
const now = require('performance-now');
const Sntp = require('sntp');
const _ = require('lodash');

function OpenBCIFactory() {
    var factory = this;

    const _options = {
        boardType: k.OBCIBoardDefault,
        simulate: false,
        simulatorSampleRate: 250,
        baudrate: 115200,
        verbose: false,
        ntp: false
    };

    /**
     * @description Creates a new object
     * @param path - The path of the serial port to connect to
     * @param options - Object with possible options:
     *     - `boardType` - Specifies type of OpenBCI board
     *          3 Possible Boards:
     *              `default` - 8 Channel OpenBCI board (Default)
     *              `daisy` - 8 Channel board with Daisy Module
     *                  (NOTE: THIS IS IN-OP AT THIS TIME DUE TO NO ACCESS TO ACCESSORY BOARD)
     *              `ganglion` - 4 Channel board
     *                  (NOTE: THIS IS IN-OP TIL RELEASE OF GANGLION BOARD 07/2016)
     *
     *     - `simulate` - Full functionality, just mock data.
     *
     *     - `simulatorSampleRate` - The sample rate to use for the simulator
     *                      (Default is `250`)
     *
     *     - `baudRate` - Baud Rate, defaults to 115200. Manipulating this is allowed if
     *                      firmware on board has been previously configured.
     *
     *     - `verbose` - Print out useful debugging events
     *     - `NTP` - Syncs the module up with an NTP time server. Syncs the board on startup
     *                  with the NTP time. Adds a time stamp to the AUX channels. (NOT FULLY
     *                  IMPLEMENTED) [DO NOT USE]
     * @param callback - error if there is one
     * @constructor
     */
    function OpenBCIBoard(path, options, callback) {
        var args = Array.prototype.slice.call(arguments);
        callback = args.pop();
        if (typeof (callback) !== 'function') {
            callback = null;
        }
        options = (typeof options !== 'function') && options || {};

        var opts = {};

        stream.Stream.call(this);

        /* Configuring Option */
        opts.boardType = options.boardType || options.boardtype || _options.boardType;
        opts.simulate = options.simulate || _options.simulate;
        opts.simulatorSampleRate = options.simulatorSampleRate || options.simulatorsamplerate || _options.simulatorSampleRate;
        opts.baudRate = options.baudRate || options.baudrate || _options.baudrate;
        opts.verbose = options.verbose || _options.verbose;
        opts.ntp = options.NTP || options.ntp || _options.NTP;

        callback = callback || function(err) {
                if (err) {
                    factory.emit('error',err);
                }
            };

        var err;
        this.options = opts;

        if (!path) {
            err = new Error('Missing path name.');
            callback(err);
        } else {
            this.pathName = path;
        }


        // STREAM stuff
        this.paused = false;
        this.readable = false;
        this.reading = false;
        this.connected = false;

        /** Properties (keep alphabetical) */
        // Arrays
        this.channelSettingsArray = k.channelSettingsArrayInit(this.numberOfChannels());
        // Bools
        this.isLookingForKeyInBuffer = true;
        this.connected = false;
        // Buffers
        this.masterBuffer = masterBufferMaker();
        this.searchBuffers = {
            timeSyncStart: new Buffer('$a$'),
            miscStop: new Buffer('$$$')
        };
        this.searchingBuf = this.searchBuffers.miscStop;
        this.writeOutBuffer = new Buffer(1);
        // Objects
        this.goertzelObject = openBCISample.goertzelNewObject(this.numberOfChannels());
        this.writer = null;
        this.impedanceTest = {
            active: false,
            isTestingPInput: false,
            isTestingNInput: false,
            onChannel: 0,
            sampleNumber: 0,
            continuousMode: false,
            impedanceForChannel: 0
        };
        this.sync = {
            npt1: 0,
            ntp2: 0
        };
        this.ntpOptions = {
            host: 'nist1-sj.ustiming.org',  // Defaults to pool.ntp.org
            port: 123,                      // Defaults to 123 (NTP)
            resolveReference: true,         // Default to false (not resolving)
            timeout: 1000                   // Defaults to zero (no timeout)
        };
        // Numbers
        this.badPackets = 0;
        this.commandsToWrite = 0;
        this.impedanceArray = openBCISample.impedanceArray(k.numberOfChannelsForBoardType(this.options.boardType));
        this.writeOutDelay = k.OBCIWriteIntervalDelayMSShort;
        this.sampleCount = 0;
        // Strings

        // NTP
        if (this.options.ntp) {
            this.sntpGetServerTime()
                .then((timeObj) => {
                    if (this.options.verbose) {
                        console.log('NTP synced successfully, time object:');
                        console.log(timeObj);
                    }
                });
        }
    }


    util.inherits(OpenBCIBoard, stream.Stream);

    // TODO: .open(): open a connection to the board, sets .readable to true
    /**
     * @description This function connects to the board via serial port or the simulator
     * @author AJ Keller (@pushtheworldllc) & Austin Shoecraft (@tashoecraft)
     */
    OpenBCIBoard.prototype.open = function() {
        this.paused = true;
        this.readable = true;
        this.reading = false;
        this.connected = false;

        // If we are simulating, set boardSerial to fake name
        /* istanbul ignore else */
        var boardSerial;
        if (this.options.simulate || this.portName === k.OBCISimulatorPortName) {
            this.options.simulate = true;
            if (this.options.verbose) console.log('using faux board ' + this.pathName);
            boardSerial = new openBCISimulator.OpenBCISimulator(this.pathName, {
                verbose: this.options.verbose,
                sampleRate: this.options.simulatorSampleRate
            });
        } else {
            /* istanbul ignore if */
            if (this.options.verbose) console.log('using real board ' + this.pathName);
            boardSerial = new serialPort.SerialPort(this.pathName, {
                baudRate: this.options.baudRate
            },(err) => {
                if (err) this.emit('error',err);
            });
        }

        this.serial = boardSerial;


        if(this.options.verbose) console.log('Serial port connected');


        boardSerial.on('open',() => {
            this.connected = true;

            var timeoutLength = this.options.simulate ? 50 : 300;
            if(this.options.verbose) console.log('Serial port open');
            setTimeout(() => {
                if(this.options.verbose) console.log('Sending stop command, in case the device was left streaming...');
                this.write(k.OBCIStreamStop);
                if (this.serial) this.serial.flush();
            },timeoutLength);
            setTimeout(() => {
                if(this.options.verbose) console.log('Sending soft reset');
                this.softReset();
                if(this.options.verbose) console.log("Waiting for '$$$'");

            },timeoutLength + 250);
        });

        boardSerial.on('data',(data) => {
            this._read(data);
        });

        boardSerial.on('close',() => {
            this.connected = false;
            if (this.options.verbose) console.log('Serial Port Closed');
            this.emit('close')
        });

        /* istanbul ignore next */
        boardSerial.on('error',(err) => {
            this.connected = false;
            if (this.options.verbose) console.log('Serial Port Error');
            this.emit('error',err);
        });
    };


    OpenBCIBoard.prototype.close = function() {

        var timeout = 0;
        if (this.reading) {
            this._write(k.OBCIStreamStop);
            timeout = 60;
        }

        setTimeout(() => {
            if (this.serial) {
                this.serial.close(() => {
                    this.emit('close');
                });
            }
            this.paused = false;
            this.readable = false;
            this.reading = false;
            this.connected = false;
        },timeout);
    };

    // TODO: .pause(): prevents any data from being emited on `data`
    OpenBCIBoard.prototype.pause = function() {
        this.paused = true;
    };

    // TODO: .resume(): allows data to be emitted on `data` again
    OpenBCIBoard.prototype.resume = function() {
        this.paused = false;

        this.buffer = null;
    };

    // TODO: ._write(): send data to the underlying resouce, how we communicate with the board
    /**
     * @description Writes a command to the board over serial port every 10 ms
     * @param chunk [String | Buffer] - The input to write to the board
     * @param encoding - [String] - The encoding of the buffer
     * @param callback - After we have written to the board.
     * @private
     * @author AJ Keller (@pushtheworldllc) & Austin Shoecraft (@tashoecraft)
     */
    OpenBCIBoard.prototype._write = function(chunk, encoding, callback) {

        callback = callback || (err => {
                if (err) {
                    this.emit('error',err);
                }
            });

        var writerFunction = () => {
            /* istanbul ignore else */
            console.log(this.commandsToWrite);
            if (this.commandsToWrite > 0) {
                var command = this.writeOutArray.shift();
                this.commandsToWrite--;
                if (this.commandsToWrite === 0) {
                    this.writer = null;
                } else {
                    this.writer = setTimeout(writerFunction,this.writeOutDelay);
                }
                this._writeAndDrain.call(this,command)
                    .catch(err => {
                        /* istanbul ignore if */
                        if(this.options.verbose) console.log('write failure: ' + err);
                    });
            } else {
                if(this.options.verbose) console.log('Big problem! Writer started with no commands to write');
            }
        };

        if (this.connected) {

            if (typeof chunk === 'string') {
                // make a new buffer the length of the string
                chunk = new Buffer(chunk);
            }

            if (this.writeOutBuffer) {
                var chunkSize = chunk.byteLength;

                var oldBufferSize = this.writeOutBuffer.byteLength;

                // Make a new buffer
                var newChunkBuffer = new Buffer(chunkSize + oldBufferSize);

                // Put old buffer in the front of the new buffer
                var oldBytesWritten = this.writeOutBuffer.copy(newChunkBuffer);

                // Move the incoming chunk into the end of the new buffer
                chunk.copy(newChunkBuffer,oldBytesWritten);

                // Over write chunk
                chunk = newChunkBuffer;
            }

            this.writeOutBuffer = chunk;

            if(this.writer === null || this.writer === undefined) { //there is no writer started
                this.writer = writerFunction();
            }

        } else {
            callback(new Error('Must be connected to board'));
        }

    };

    // TODO: ._read(): method to process data
    /**
     * @description Consider the '_processBytes' method to be the work horse of this
     *              entire framework. This method gets called any time there is new
     *              data coming in on the serial port. If you are familiar with the
     *              'serialport' package, then every time data is emitted, this function
     *              gets sent the input data.
     * @param data - a buffer of unknown size
     * @author AJ Keller (@pushtheworldllc) & Austin Shoecraft (@tashoecraft)
     */
    OpenBCIBoard.prototype._read = function(data) {

        // if we are not reading, then we should be looking for the EOT key in the buffer
        if (this.reading) {
            this._processData(data);
        } else {
            this._processInfo(info);
        }
    };


    /**
     * @description Takes input data while paused and handles non-data information
     * @param info - A buffer of input data from serial port
     * @private
     * @author AJ Keller (@pushtheworldllc) & Austin Shoecraft (@tashoecraft)
     */
    OpenBCIBoard.prototype._processInfo = function(info) {

        // Always emit input out of `info`
        this.emit('info',info);

        // See if EOT ($$$) is inside the info (input) buffer
        var sizeOfData = info.byteLength;
        var sizeOfSearchBuf = this.searchingBuf.byteLength; // then size in bytes of the buffer we are searching for

        for (var i = 0; i < sizeOfData - (sizeOfSearchBuf - 1); i++) {
            if (this.searchingBuf.equals(info.slice(i, i + sizeOfSearchBuf))) { // slice a chunk of the buffer to analyze
                if (this.searchingBuf.equals(this.searchBuffers.miscStop)) {
                    if (this.options.verbose)  {
                        console.log('Received EOT!');
                    }
                    this._write(k.OBCIStreamStart);

                    this.reading = true;

                }
            }
        }
    };

    /**
     * @description This is called when we are connected and reading is true
     * @param data - A buffer of input data to read from serial port
     * @private
     * @author AJ Keller (@pushtheworldllc) & Austin Shoecraft (@tashoecraft)
     */
    OpenBCIBoard.prototype._processData = function(data) {
        // So the main idea is that serial port gives fragmented data, in that we may get a less than a packet of data
        //  or we may get 2 1/2 packets of data, we must be ready

        if (!this.paused) {
            var bytesToRead = data.byteLength;
            this.bytesIn += bytesToRead;

            // is there old data?
            if (this.buffer) {
                // Get size of old buffer
                var oldBufferSize = this.buffer.byteLength;

                // Make a new buffer
                var newDataBuffer = new Buffer(bytesToRead + oldBufferSize);

                // Put old buffer in the front of the new buffer
                var oldBytesWritten = this.buffer.copy(newDataBuffer);

                // Move the incoming data into the end of the new buffer
                data.copy(newDataBuffer,oldBytesWritten);

                // Over write data
                data = newDataBuffer;

                // Update the number of bytes to read
                bytesToRead += oldBytesWritten;
            }

            var readingPosition = 0;

            // 45 < (200 - 33) --> 45 < 167 (good) | 189 < 167 (bad) | 0 < (28 - 33) --> 0 < -5 (bad)
            while (readingPosition <= bytesToRead - k.OBCIPacketSize) {
                if (data[readingPosition] === k.OBCIByteStart) {
                    var rawPacket = data.slice(readingPosition, readingPosition + k.OBCIPacketSize);
                    if (data[readingPosition + k.OBCIPacketSize - 1] === k.OBCIByteStop) {
                        // standard packet!
                        openBCISample.parseRawPacket(rawPacket,this.channelSettingsArray)
                            .then(sampleObject => {

                                sampleObject._count = this.sampleCount++;
                                if(this.impedanceTest.active) {
                                    var impedanceArray;
                                    if (this.impedanceTest.continuousMode) {
                                        //console.log('running in contiuous mode...');
                                        //openBCISample.debugPrettyPrint(sampleObject);
                                        impedanceArray = openBCISample.goertzelProcessSample(sampleObject,this.goertzelObject)
                                        if (impedanceArray) {
                                            this.emit('impedanceArray',impedanceArray);
                                        }
                                    } else if (this.impedanceTest.onChannel != 0) {
                                        // Only calculate impedance for one channel
                                        impedanceArray = openBCISample.goertzelProcessSample(sampleObject,this.goertzelObject)
                                        if (impedanceArray) {
                                            this.impedanceTest.impedanceForChannel = impedanceArray[this.impedanceTest.onChannel - 1];
                                        }
                                    }
                                } else {
                                    this.emit('data', sampleObject);
                                }
                            });
                    }
                }

                // increment reading position
                readingPosition++;
            }

            // Are there any bytes to move into the buffer?
            if (readingPosition < bytesToRead) {
                this.buffer = new Buffer(bytesToRead - readingPosition);

                data.copy(this.buffer);

            } else {
                this.buffer = null;
            }
        }
    };

    /**
     * @description Should be used to send data to the board
     * @param data
     * @returns {Promise} if signal was able to be sent
     * @author AJ Keller (@pushtheworldllc)
     */
    OpenBCIBoard.prototype._writeAndDrain = function(data) {
        return new Promise((resolve,reject) => {
            //console.log('writing command ' + data);
            if(!this.serial) reject('Serial port not open');
            this.serial.write(data,(error,results) => {
                if(results) {
                    this.serial.drain(function() {
                        resolve();
                    });
                } else {
                    console.log('Error [writeAndDrain]: ' + error);
                    reject(error);
                }
            })
        });
    };


    OpenBCIBoard.prototype.numberOfChannels = function(){
        return this.options.boardType === k.OBCIBoardDaisy ? k.OBCINumberOfChannelsDaisy : k.OBCINumberOfChannelsDefault;
    };

    /**
     * @description Automatically find an OpenBCI board.
     * Note: This method is used for convenience and should be used when trying to
     *           connect to a board. If you find a case (i.e. a platform (linux,
     *           windows...) that this does not work, please open an issue and
     *           we will add support!
     * @author AJ Keller (@pushtheworldllc) && Austin Shoecraft (tashoecraft)
     * @returns {Promise} - Fulfilled with portName, rejected when can't find the board.
     */
    OpenBCIBoard.prototype.autoFindOpenBCIBoard = function() {
        var macSerialPrefix = 'usbserial-D';
        return new Promise((resolve, reject) => {
            /* istanbul ignore else  */
            if (this.options.simulate) {
                this.portName = k.OBCISimulatorPortName;
                if (this.options.verbose) console.log('auto found sim board');
                resolve(k.OBCISimulatorPortName);
            } else {
                serialPort.list((err, ports) => {
                    if(err) {
                        if (this.options.verbose) console.log('serial port err');
                        reject(err);
                    }
                    if(ports.some(port => {
                            if(port.comName.includes(macSerialPrefix)) {
                                this.portName = port.comName;
                                return true;
                            }
                        })) {
                        if (this.options.verbose) console.log('auto found board');
                        resolve(this.portName);
                    }
                    else {
                        if (this.options.verbose) console.log('could not find board');
                        reject('Could not auto find board');
                    }
                });
            }
        })
    };



    factory.OpenBCIBoard = OpenBCIBoard;
    factory.OpenBCISample = openBCISample;

}
util.inherits(OpenBCIFactory, EventEmitter);

module.exports = new OpenBCIFactory();

function masterBufferMaker() {
    var masterBuf = new Buffer(k.OBCIMasterBufferSize);
    masterBuf.fill(0);
    return { // Buffer used to store bytes in and read packets from
        buffer: masterBuf,
        positionRead: 0,
        positionWrite: 0,
        packetsIn:0,
        packetsRead:0,
        looseBytes:0
    };
}