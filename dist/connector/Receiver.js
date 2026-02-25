"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Receiver = void 0;
const iconv = require("iconv-lite");
const debug = require("debug");
const RosException_1 = require("../RosException");
const info = debug('routeros-api:connector:receiver:info');
const error = debug('routeros-api:connector:receiver:error');
const nullBuffer = Buffer.from([0x00]);
/**
 * Class responsible for receiving and parsing the socket
 * data, sending to the readers and listeners
 */
class Receiver {
    /**
     * Receives the socket so we are able to read
     * the data sent to it, separating each tag
     * to the according listener.
     *
     * @param socket
     */
    constructor(socket) {
        /**
         * The registered tags to answer data to
         */
        this.tags = new Map();
        /**
         * The length of the current data chain received from
         * the socket
         */
        this.dataLength = 0;
        /**
         * A pipe of all responses received from the routerboard
         */
        this.sentencePipe = [];
        /**
         * Flag if the sentencePipe is being processed to
         * prevent concurrent sentences breaking the pipe
         */
        this.processingSentencePipe = false;
        /**
         * The current line being processed from the data chain
         */
        this.currentLine = '';
        /**
         * The current reply received for the tag
         */
        this.currentReply = '';
        /**
         * The current tag which the routerboard responded
         */
        this.currentTag = '';
        /**
         * The current data chain or packet
         */
        this.currentPacket = [];
        this.socket = socket;
    }
    /**
     * Register the tag as a reader so when
     * the routerboard respond to the command
     * related to the tag, we know where to send
     * the data to
     *
     * @param {string} tag
     * @param {function} callback
     */
    read(tag, callback) {
        info('Reader of %s tag is being set', tag);
        this.tags.set(tag, {
            name: tag,
            callback: callback,
        });
    }
    /**
     * Stop reading from a tag, removing it
     * from the tag mapping. Usually it is closed
     * after the command has being !done, since each command
     * opens a new auto-generated tag
     *
     * @param {string} tag
     */
    stop(tag) {
        info('Not reading from %s tag anymore', tag);
        this.tags.delete(tag);
    }
    /**
     * Proccess the raw buffer data received from the routerboard,
     * decode using win1252 encoded string from the routerboard to
     * utf-8, so languages with accentuation works out of the box.
     *
     * After reading each sentence from the raw packet, sends it
     * to be parsed
     *
     * @param {Buffer} data
     */
    processRawData(data) {
        if (this.lengthDescriptorSegment) {
            data = Buffer.concat([this.lengthDescriptorSegment, data]);
            this.lengthDescriptorSegment = null;
        }
        // Loop through the data we just received
        while (data.length > 0) {
            // If this does not contain the beginning of a packet...
            if (this.dataLength > 0) {
                // If the length of the data we have in our buffer
                // is less than or equal to that reported by the
                // bytes used to dermine length...
                if (data.length <= this.dataLength) {
                    // Subtract the data we are taking from the length we desire
                    this.dataLength -= data.length;
                    // Add this data to our current line
                    this.currentLine += iconv.decode(data, 'win1252');
                    // If there is no more desired data we want...
                    if (this.dataLength === 0) {
                        // Push the data to the sentance
                        this.sentencePipe.push({
                            sentence: this.currentLine,
                            hadMore: data.length !== this.dataLength,
                        });
                        // process the sentance and clear the line
                        this.processSentence();
                        this.currentLine = '';
                    }
                    // Break out of processRawData and wait for the next
                    // set of data from the socket
                    break;
                    // If we have more data than we desire...
                }
                else {
                    // slice off the part that we desire
                    const tmpBuffer = data.slice(0, this.dataLength);
                    // decode this segment
                    const tmpStr = iconv.decode(tmpBuffer, 'win1252');
                    // Add this to our current line
                    this.currentLine += tmpStr;
                    // save our line...
                    const line = this.currentLine;
                    // clear the current line
                    this.currentLine = '';
                    // cut off the line we just pulled out
                    data = data.slice(this.dataLength);
                    // determine the length of the next word. This method also
                    // returns the number of bytes it took to describe the length
                    const [descriptor_length, length] = this.decodeLength(data);
                    // If we do not have enough data to determine
                    // the length... we wait for the next loop
                    // and store the length descriptor segment
                    if (descriptor_length > data.length) {
                        this.lengthDescriptorSegment = data;
                    }
                    // Save this as our next desired length
                    this.dataLength = length;
                    // slice off the bytes used to describe the length
                    data = data.slice(descriptor_length);
                    // If we only desire one more and its the end of the sentance...
                    if (this.dataLength === 1 && data.equals(nullBuffer)) {
                        this.dataLength = 0;
                        data = data.slice(1); // get rid of excess buffer
                    }
                    this.sentencePipe.push({
                        sentence: line,
                        hadMore: data.length > 0,
                    });
                    this.processSentence();
                }
                // This is the beginning of this packet...
                // This ALWAYS gets run first
            }
            else {
                // returns back the start index of the data and the length
                const [descriptor_length, length] = this.decodeLength(data);
                // store how long our data is
                this.dataLength = length;
                // slice off the bytes used to describe the length
                data = data.slice(descriptor_length);
                if (this.dataLength === 1 && data.equals(nullBuffer)) {
                    this.dataLength = 0;
                    data = data.slice(1); // get rid of excess buffer
                }
            }
        }
    }
    /**
     * Process each sentence from the data packet received.
     *
     * Detects the .tag of the packet, sending the data to the
     * related tag when another reply is detected or if
     * the packet had no more lines to be processed.
     *
     */
    processSentence() {
        if (!this.processingSentencePipe) {
            info('Got asked to process sentence pipe');
            this.processingSentencePipe = true;
            const process = () => {
                if (this.sentencePipe.length > 0) {
                    const line = this.sentencePipe.shift();
                    if (!line.hadMore && this.currentReply === '!fatal') {
                        this.socket.emit('fatal');
                        return;
                    }
                    info('Processing line %s', line.sentence);
                    if (/^\.tag=/.test(line.sentence)) {
                        this.currentTag = line.sentence.substring(5);
                    }
                    else if (/^!/.test(line.sentence)) {
                        if (this.currentTag) {
                            info('Received another response, sending current data to tag %s', this.currentTag);
                            this.sendTagData(this.currentTag);
                        }
                        this.currentPacket.push(line.sentence);
                        this.currentReply = line.sentence;
                    }
                    else {
                        this.currentPacket.push(line.sentence);
                    }
                    if (this.sentencePipe.length === 0 &&
                        this.dataLength === 0) {
                        if (!line.hadMore && this.currentTag) {
                            info('No more sentences to process, will send data to tag %s', this.currentTag);
                            this.sendTagData(this.currentTag);
                        }
                        else {
                            info('No more sentences and no data to send');
                        }
                        this.processingSentencePipe = false;
                    }
                    else {
                        process();
                    }
                }
                else {
                    this.processingSentencePipe = false;
                }
            };
            process();
        }
    }
    /**
     * Send the data collected from the tag to the
     * tag reader
     */
    sendTagData(currentTag) {
        const tag = this.tags.get(currentTag);
        if (tag) {
            info('Sending to tag %s the packet %O', tag.name, this.currentPacket);
            tag.callback(this.currentPacket);
        }
        else {
            throw new RosException_1.RosException('UNREGISTEREDTAG');
        }
        this.cleanUp();
    }
    /**
     * Clean the current packet, tag and reply state
     * to start over
     */
    cleanUp() {
        this.currentPacket = [];
        this.currentTag = null;
        this.currentReply = null;
    }
    /**
     * Decodes the length of the buffer received
     *
     * Credits for George Joseph: https://github.com/gtjoseph
     * and for Brandon Myers: https://github.com/Trakkasure
     *
     * @param {Buffer} data
     */
    decodeLength(data) {
        let len;
        let idx = 0;
        const b = data[idx++];
        if (b & 128) {
            if ((b & 192) === 128) {
                len = ((b & 63) << 8) + data[idx++];
            }
            else {
                if ((b & 224) === 192) {
                    len = ((b & 31) << 8) + data[idx++];
                    len = (len << 8) + data[idx++];
                }
                else {
                    if ((b & 240) === 224) {
                        len = ((b & 15) << 8) + data[idx++];
                        len = (len << 8) + data[idx++];
                        len = (len << 8) + data[idx++];
                    }
                    else {
                        len = data[idx++];
                        len = (len << 8) + data[idx++];
                        len = (len << 8) + data[idx++];
                        len = (len << 8) + data[idx++];
                    }
                }
            }
        }
        else {
            len = b;
        }
        return [idx, len];
    }
}
exports.Receiver = Receiver;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUmVjZWl2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29ubmVjdG9yL1JlY2VpdmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLG9DQUFvQztBQUNwQywrQkFBK0I7QUFDL0Isa0RBQStDO0FBRS9DLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO0FBQzNELE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO0FBQzdELE1BQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBZ0J2Qzs7O0dBR0c7QUFDSCxNQUFhLFFBQVE7SUF1RGpCOzs7Ozs7T0FNRztJQUNILFlBQVksTUFBYztRQXhEMUI7O1dBRUc7UUFDSyxTQUFJLEdBQStCLElBQUksR0FBRyxFQUFFLENBQUM7UUFFckQ7OztXQUdHO1FBQ0ssZUFBVSxHQUFXLENBQUMsQ0FBQztRQUUvQjs7V0FFRztRQUNLLGlCQUFZLEdBQWdCLEVBQUUsQ0FBQztRQUV2Qzs7O1dBR0c7UUFDSywyQkFBc0IsR0FBWSxLQUFLLENBQUM7UUFFaEQ7O1dBRUc7UUFDSyxnQkFBVyxHQUFXLEVBQUUsQ0FBQztRQUVqQzs7V0FFRztRQUNLLGlCQUFZLEdBQVcsRUFBRSxDQUFDO1FBRWxDOztXQUVHO1FBQ0ssZUFBVSxHQUFXLEVBQUUsQ0FBQztRQUVoQzs7V0FFRztRQUNLLGtCQUFhLEdBQWEsRUFBRSxDQUFDO1FBaUJqQyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUN6QixDQUFDO0lBRUQ7Ozs7Ozs7O09BUUc7SUFDSSxJQUFJLENBQUMsR0FBVyxFQUFFLFFBQW9DO1FBQ3pELElBQUksQ0FBQywrQkFBK0IsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUMzQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUU7WUFDZixJQUFJLEVBQUUs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