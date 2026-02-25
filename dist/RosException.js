"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RosException = void 0;
const messages_1 = require("./messages");
/**
 * RouterOS Exception Handler
 */
class RosException extends Error {
    constructor(errno, extras) {
        super();
        // Maintains proper stack trace for where our error was thrown
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        // Custom debugging information
        this.errno = errno;
        let message = messages_1.default[errno];
        if (message) {
            for (const key in extras) {
                if (extras.hasOwnProperty(key)) {
                    message = message.replace(`{{${key}}}`, extras[key]);
                }
            }
            this.message = message;
        }
    }
}
exports.RosException = RosException;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUm9zRXhjZXB0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL1Jvc0V4Y2VwdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5Q0FBa0M7QUFFbEM7O0dBRUc7QUFDSCxNQUFhLFlBQWEsU0FBUSxLQUFLO0lBR25DLFlBQVksS0FBYSxFQUFFLE1BQVk7UUFDbkMsS0FBSyxFQUFFLENBQUM7UUFFUiw4REFBOEQ7UUFDOUQsS0FBSyxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFaEQsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztRQUVsQywrQkFBK0I7UUFDL0IsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFFbkIsSUFBSSxPQUFPLEdBQUcsa0JBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUU5QixJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ1YsS0FBSyxNQUFNLEdBQUcsSUFBSSxNQUFNLEVBQUUsQ0FBQztnQkFDdkIsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQzdCLE9BQU8sR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssR0FBRyxJQUFJLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pELENBQUM7WUFDTCxDQUFDO1lBQ0QsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDM0IsQ0FBQztJQUNMLENBQUM7Q0FDSjtBQXpCRCxvQ0F5QkMifQ==