var chai = require('chai'),
    should = chai.should(),
    expect = chai.expect,
    openBCIBoard = require('../openBCIBoard'),
    OpenBCISample = openBCIBoard.OpenBCISample;


describe('openbci-sdk',function() {
    describe('#testsWithBoard', function() {
        this.timeout(10000);
        xdescribe('#connect', function() {
            var running = false;
            beforeEach(function(done) {
                var ourBoard = new openBCIBoard.OpenBCIBoard();

                ourBoard.autoFindOpenBCIBoard(function(portName,ports) {
                    if(portName) {
                        ourBoard.connect(portName).then(function(boardSerial) {
                            console.log('board connected');
                            ourBoard.on('ready',function() {
                                console.log('Ready to start streaming!');
                                ourBoard.streamStart();
                                ourBoard.on('sample',function(sample) {
                                    //OpenBCISample.debugPrettyPrint(sample);
                                });
                            });
                        }).catch(function(err) {
                            console.log('Error [setup]: ' + err);
                            done();
                        });

                    } else {
                        /** Display list of ports*/
                        console.log('Port not found... check ports for other ports');
                        done();
                    }
                });
                setTimeout(function() {
                    ourBoard.streamStop().then(ourBoard.disconnect()).then(function(msg) {
                        running = true;
                        done();
                    }, function(err) {
                        console.log('Error: ' + err);
                        done();
                    });
                },5000);
            });
            it('should stop the simulator after 5 seconds', function() {
                expect(running).equals(true);
            });
        });
        describe('#printRegisterSettings', function() {
            var running = false;
            var didTryToSendPrintCommand = false;
            var didTryToTurnChannel1Off = false;
            beforeEach(function(done) {
                var ourBoard = new openBCIBoard.OpenBCIBoard();

                ourBoard.autoFindOpenBCIBoard(function (portName, ports) {
                    if (portName) {
                        ourBoard.connect(portName).then(function (boardSerial) {
                            console.log('board connected');
                            ourBoard.on('ready', function () {
                                console.log('Ready to print register settings!');
                                if (!didTryToSendPrintCommand) {
                                    didTryToSendPrintCommand = true;
                                    ourBoard.printRegisterSettings();
                                } else if (!didTryToTurnChannel1Off) {
                                    didTryToTurnChannel1Off = true;
                                    console.log('Tried to turn channel 1 off');
                                    ourBoard.channelOff(1);
                                    setTimeout(function() {
                                        console.log('Re print register settings');
                                        ourBoard.printRegisterSettings();
                                    },100);
                                }
                            });
                        }).catch(function (err) {
                            console.log('Error [setup]: ' + err);
                            done();
                        });

                    } else {
                        /** Display list of ports*/
                        console.log('Port not found... check ports for other ports');
                        done();
                    }
                });
                setTimeout(function () {
                    ourBoard.streamStop().then(ourBoard.disconnect()).then(function (msg) {
                        running = true;
                        done();
                    }, function (err) {
                        console.log('Error: ' + err);
                        done();
                    });
                }, 8000);
            });
            it('should print the register settings', function() {
                expect(running).equals(true);
            });
        });
    });
    xdescribe('#boardSimulator', function() {
        var running = false;
        beforeEach(function(done) {
            var ourBoard = new openBCIBoard.OpenBCIBoard();

            ourBoard.simulatorStart().then(function() {
                console.log('Simulator started');
                ourBoard.on('sample',function(sample) {
                    //OpenBCISample.debugPrettyPrint(sample);
                });
            }).catch(function(err) {
                console.log('Error [simulator]: ' + err);
            });
            setTimeout(function() {
                ourBoard.simulatorStop().then(function() {
                    running = true;
                    done();
                },function(err) {
                    console.log('Error: ' + err);
                    done();
                });
            },1000);
        });
        it('should stop the simulator after 1 second', function() {
            expect(running).equals(true);
        });
    });
});