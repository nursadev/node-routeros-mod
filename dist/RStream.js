"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RStream = void 0;
const events_1 = require("events");
const Channel_1 = require("./Channel");
const RosException_1 = require("./RosException");
const timers_1 = require("timers");
const utils_1 = require("./utils");
/**
 * Stream class is responsible for handling
 * continuous data from some parts of the
 * routeros, like /ip/address/listen or
 * /tool/torch which keeps sending data endlessly.
 * It is also possible to pause/resume/stop generated
 * streams.
 */
class RStream extends events_1.EventEmitter {
    /**
     * Constructor, it also starts the streaming after construction
     *
     * @param {Channel} channel
     * @param {Array} params
     * @param {function} callback
     */
    constructor(channel, params, callback) {
        super();
        /** Flag for turning on empty data debouncing */
        this.shouldDebounceEmptyData = false;
        /**
         * If is streaming flag
         */
        this.streaming = true;
        /**
         * If is pausing flag
         */
        this.pausing = false;
        /**
         * If is paused flag
         */
        this.paused = false;
        /**
         * If is stopping flag
         */
        this.stopping = false;
        /**
         * If is stopped flag
         */
        this.stopped = false;
        /**
         * If got a trap error
         */
        this.trapped = false;
        /**
         * Save the current section of the packet, if has any
         */
        this.currentSection = null;
        this.forcelyStop = false;
        /**
         * Store the current section in a single
         * array before sending when another section comes
         */
        this.currentSectionPacket = [];
        this.channel = channel;
        this.params = params;
        this.callback = callback;
    }
    /**
     * Function to receive the callback which
     * will receive data, if not provided over the
     * constructor or changed later after the streaming
     * have started.
     *
     * @param {function} callback
     */
    data(callback) {
        this.callback = callback;
    }
    /**
     * Resume the paused stream, using the same channel
     *
     * @returns {Promise}
     */
    resume() {
        if (this.stopped || this.stopping)
            return Promise.reject(new RosException_1.RosException('STREAMCLOSD'));
        if (!this.streaming) {
            this.pausing = false;
            this.start();
            this.streaming = true;
        }
        return Promise.resolve();
    }
    /**
     * Pause the stream, but don't destroy the channel
     *
     * @returns {Promise}
     */
    pause() {
        if (this.stopped || this.stopping)
            return Promise.reject(new RosException_1.RosException('STREAMCLOSD'));
        if (this.pausing || this.paused)
            return Promise.resolve();
        if (this.streaming) {
            this.pausing = true;
            return this.stop(true)
                .then(() => {
                this.pausing = false;
                this.paused = true;
                return Promise.resolve();
            })
                .catch((err) => {
                return Promise.reject(err);
            });
        }
        return Promise.resolve();
    }
    /**
     * Stop the stream entirely, can't re-stream after
     * this if called directly.
     *
     * @returns {Promise}
     */
    stop(pausing = false) {
        if (this.stopped || this.stopping)
            return Promise.resolve();
        if (!pausing)
            this.forcelyStop = true;
        if (this.paused) {
            this.streaming = false;
            this.stopping = false;
            this.stopped = true;
            if (this.channel)
                this.channel.close(true);
            return Promise.resolve();
        }
        if (!this.pausing)
            this.stopping = true;
        let chann = new Channel_1.Channel(this.channel.Connector);
        chann.on('close', () => {
            chann = null;
        });
        if (this.debounceSendingEmptyData)
            this.debounceSendingEmptyData.cancel();
        return chann
            .write(['/cancel', '=tag=' + this.channel.Id])
            .then(() => {
            this.streaming = false;
            if (!this.pausing) {
                this.stopping = false;
                this.stopped = true;
            }
            this.emit('stopped');
            return Promise.resolve();
        })
            .catch((err) => {
            return Promise.reject(err);
        });
    }
    /**
     * Alias for stop()
     */
    close() {
        return this.stop();
    }
    /**
     * Write over the connection and start the stream
     */
    start() {
        if (!this.stopped && !this.stopping) {
            this.channel.on('close', () => {
                if (this.forcelyStop || (!this.pausing && !this.paused)) {
                    if (!this.trapped)
                        this.emit('done');
                    this.emit('close');
                }
                this.stopped = false;
            });
            this.channel.on('stream', (packet) => {
                if (this.debounceSendingEmptyData)
                    this.debounceSendingEmptyData.run();
                this.onStream(packet);
            });
            this.channel.once('trap', this.onTrap.bind(this));
            this.channel.once('done', this.onDone.bind(this));
            this.channel.write(this.params.slice(), true, false);
            this.emit('started');
            if (this.shouldDebounceEmptyData)
                this.prepareDebounceEmptyData();
        }
    }
    prepareDebounceEmptyData() {
        this.shouldDebounceEmptyData = true;
        const intervalParam = this.params.find((param) => {
            return /=interval=/.test(param);
        });
        let interval = 2000;
        if (intervalParam) {
            const val = intervalParam.split('=')[2];
            interval = parseInt(val, null) * 1000;
        }
        this.debounceSendingEmptyData = (0, utils_1.debounce)(() => {
            if (!this.stopped ||
                !this.stopping ||
                !this.paused ||
                !this.pausing) {
                this.onStream([]);
                this.debounceSendingEmptyData.run();
            }
        }, interval + 300);
    }
    /**
     * When receiving the stream packet, give it to
     * the callback
     *
     * @returns {function}
     */
    onStream(packet) {
        this.emit('data', packet);
        if (this.callback) {
            if (packet['.section']) {
                (0, timers_1.clearTimeout)(this.sectionPacketSendingTimeout);
                const sendData = () => {
                    this.callback(null, this.currentSectionPacket.slice(), this);
                    this.currentSectionPacket = [];
                };
                this.sectionPacketSendingTimeout = (0, timers_1.setTimeout)(sendData.bind(this), 300);
                if (this.currentSectionPacket.length > 0 &&
                    packet['.section'] !== this.currentSection) {
                    (0, timers_1.clearTimeout)(this.sectionPacketSendingTimeout);
                    sendData();
                }
                this.currentSection = packet['.section'];
                this.currentSectionPacket.push(packet);
            }
            else {
                this.callback(null, packet, this);
            }
        }
    }
    /**
     * When receiving a trap over the connection,
     * when pausing, will receive a 'interrupted' message,
     * this will not be considered as an error but a flag
     * for the pause and resume function
     *
     * @returns {function}
     */
    onTrap(data) {
        if (data.message === 'interrupted') {
            this.streaming = false;
        }
        else {
            this.stopped = true;
            this.trapped = true;
            if (this.callback) {
                this.callback(new Error(data.message), null, this);
            }
            else {
                this.emit('error', data);
            }
            this.emit('trap', data);
        }
    }
    /**
     * When the channel stops sending data.
     * It will close the channel if the
     * intention was stopping it.
     *
     * @returns {function}
     */
    onDone() {
        if (this.stopped && this.channel) {
            this.channel.close(true);
        }
    }
}
exports.RStream = RStream;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUlN0cmVhbS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9SU3RyZWFtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFzQztBQUN0Qyx1Q0FBb0M7QUFDcEMsaURBQThDO0FBQzlDLG1DQUFrRDtBQUNsRCxtQ0FBbUM7QUFFbkM7Ozs7Ozs7R0FPRztBQUNILE1BQWEsT0FBUSxTQUFRLHFCQUFZO0lBNkVyQzs7Ozs7O09BTUc7SUFDSCxZQUNJLE9BQWdCLEVBQ2hCLE1BQWdCLEVBQ2hCLFFBQStEO1FBRS9ELEtBQUssRUFBRSxDQUFDO1FBL0RaLGdEQUFnRDtRQUN4Qyw0QkFBdUIsR0FBWSxLQUFLLENBQUM7UUFFakQ7O1dBRUc7UUFDSyxjQUFTLEdBQVksSUFBSSxDQUFDO1FBRWxDOztXQUVHO1FBQ0ssWUFBTyxHQUFZLEtBQUssQ0FBQztRQUVqQzs7V0FFRztRQUNLLFdBQU0sR0FBWSxLQUFLLENBQUM7UUFFaEM7O1dBRUc7UUFDSyxhQUFRLEdBQVksS0FBSyxDQUFDO1FBRWxDOztXQUVHO1FBQ0ssWUFBTyxHQUFZLEtBQUssQ0FBQztRQUVqQzs7V0FFRztRQUNLLFlBQU8sR0FBWSxLQUFLLENBQUM7UUFFakM7O1dBRUc7UUFDSyxtQkFBYyxHQUFXLElBQUksQ0FBQztRQUU5QixnQkFBVyxHQUFZLEtBQUssQ0FBQztRQUVyQzs7O1dBR0c7UUFDSyx5QkFBb0IsR0FBVSxFQUFFLENBQUM7UUFvQnJDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO0lBQzdCLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0ksSUFBSSxDQUNQLFFBQThEO1FBRTlELElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO0lBQzdCLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksTUFBTTtRQUNULElBQUksSUFB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