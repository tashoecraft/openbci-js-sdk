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
    const factory = this;

    const _options = {
        boardType: k.OBCIBoardDefault,
        simulate: true,
        simulatorSampleRate: 250,
        baudrate: 115200,
        berbose: false,
        ntp: false
    };

    function OpenBCIBoard(options) {

        options = (typeof options !== 'function') && options || {};

        var opts = {};

        //stream.Stream.call(this);

        /* Configuring Option */
        opts.boardType = options.boardType || options.boardtype || _options.boardType;
        opts.simulate = options.simulate || _options.simulate;
        opts.simulatorSampleRate = options.simulatorSampleRate || options.simulatorsamplerate || _options.simulatorSampleRate;
        opts.baudRate = options.baudRate || options.baudrate || _options.baudrate;
        opts.verbose = options.verbose || _options.verbose;
        opts.ntp = options.NTP || options.ntp || _options.NTP;

        this.options = opts;

        /** Properties (keep alphabetical) */
            // Arrays
        this.writeOutArray = new Array(100);
        this.channelSettingsArray = k.channelSettingsArrayInit(this.numberOfChannels());
        // Bools
        this.isLookingForKeyInBuffer = true;
        // Buffers
        this.masterBuffer = masterBufferMaker();
        this.searchBuffers = {
            timeSyncStart: new Buffer('$a$'),
            miscStop: new Buffer('$$$')
        };
        this.searchingBuf = this.searchBuffers.miscStop;
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

        //TODO: Add connect immediately functionality, suggest this to be the default...

        /**
         * @description The essential precursor method to be called initially to establish a
         *              serial connection to the OpenBCI board.
         * @param portName - a string that contains the port name of the OpenBCIBoard.
         * @returns {Promise} if the board was able to connect.
         * @author AJ Keller (@pushtheworldllc) && Austin Shoecraft (@tashoecraft)
         */
    }
    util.inherits(OpenBCIBoard, stream.Stream);

    OpenBCIBoard.prototype.connect = function(portName) {
        // If we are simulating, set boardSerial to fake name
        /* istanbul ignore else */
        var boardSerial;
        if (this.options.simulate || portName === k.OBCISimulatorPortName) {
            this.options.simulate = true;
            if (this.options.verbose) console.log('using faux board ' + portName);
            boardSerial = new openBCISimulator.OpenBCISimulator(portName, {
                verbose: this.options.verbose,
                sampleRate: this.options.simulatorSampleRate
            });
        } else {
            /* istanbul ignore if */
            if (this.options.verbose) console.log('using real board ' + portName);
            boardSerial = new serialPort.SerialPort(portName, {
                baudRate: this.options.baudRate
            },(err) => {
                if (err) this.emit('error',err);
            });
        }

        this.serial = boardSerial;
        this.connected = this.serial.connected;
        this.paused = this.serial.paused;
        this.readable = this.serial.readable;
        this.reading = this.serial.reading;
        return true;
    };

    OpenBCIBoard.prototype.isConnected = function(){ return this.isConnected};

    OpenBCIBoard.prototype.numberOfChannels = function(){
        return this.options.boardType === k.OBCIBoardDaisy ? k.OBCINumberOfChannelsDaisy : k.OBCINumberOfChannelsDefault;
    };

    OpenBCIBoard.prototype.disconnect = function() {

    };

    OpenBCIBoard.prototype._transform = function(chunk, cb) {
        
    };

    factory.OpenBCIBoard = OpenBCIBoard;
    factory.OpenBCISample = openBCISample;

}

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