var sinon = require('sinon');
var chai = require('chai'),
    should = chai.should(),
    expect = chai.expect,
    openBCIBoard = require('../openBCIBoard.rewrite'),
    OpenBCISample = openBCIBoard.OpenBCISample,
    k = OpenBCISample.k;

var chaiAsPromised = require("chai-as-promised");
var sinonChai = require("sinon-chai");
chai.use(chaiAsPromised);
chai.use(sinonChai);

var fs = require('fs');

describe('openBCIsdk', function() {
    this.timeout(2000);
    var ourBoard;


    describe("#constructor", function() {
        it('contructs with the correct default options', function() {
            ourBoard = new openBCIBoard.OpenBCIBoard(k.OBCISimulatorPortName);
            (ourBoard.options.boardType).should.equal('default');
            (ourBoard.options.simulate).should.equal(false);
            (ourBoard.options.simulatorSampleRate).should.equal(250);
            (ourBoard.options.baudRate).should.equal(115200);
            (ourBoard.options.verbose).should.equal(false);
        })
    });
    describe('#open connection', function() {
        ourBoard = new openBCIBoard.OpenBCIBoard(k.OBCISimulatorPortName, {simulate: true});
        ourBoard.open();

        it('on open stream should be paused', function() {
            ourBoard.on('open', () => {
                (ourBoard.paused).should.equal(true);
            })
        });
        it('on open stream should be readble', function() {
            ourBoard.on('open', () => {
                (ourBoard.readable).should.equal(true);
            })
        });
        it('on open stream should be connected', function() {
            ourBoard.on('open', () => {
                (ourBoard.connected).should.equal(true);
            })
        });
        it('on open stream should not be reading', function() {
            ourBoard.on('open', () => {
                (ourBoard.reading).should.equal(false);
            })
        });
    });
    describe('#pause/resume connection', function() {
        ourBoard = new openBCIBoard.OpenBCIBoard(k.OBCISimulatorPortName, {simulate: true});
        ourBoard.open();
        it('should resume when paused', function() {
            ourBoard.resume();
            (ourBoard.paused).should.equal(false);
        });
        it('should pause when streaming', function() {
            ourBoard.pause();
            (ourBoard.paused).should.equal(true);
        });
    });
    describe('#close connection', function() {
        ourBoard = new openBCIBoard.OpenBCIBoard(k.OBCISimulatorPortName, {simulate: true});
        ourBoard.open();
        ourBoard.close();

        it('o closed stream should not be paused', function() {
            ourBoard.on('close', () => {
                (ourBoard.paused).should.equal(false);
            })
        });
        it('o closed stream should not be readble', function() {
            ourBoard.on('open', () => {
                (ourBoard.readable).should.equal(false);
            })
        });
        it('o closed stream should not be connected', function() {
            ourBoard.on('open', () => {
                (ourBoard.connected).should.equal(false);
            })
        });
        it('o closed stream should not be reading', function() {
            ourBoard.on('open', () => {
                (ourBoard.reading).should.equal(false);
            })
        });
    })



});

