"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const chalk_1 = __importDefault(require("chalk"));
class Logger {
    /**
     * Log an informational message
     */
    info(message) {
        console.log(chalk_1.default.blue(`[INFO] ${message}`));
    }
    /**
     * Log a success message
     */
    success(message) {
        console.log(chalk_1.default.green(`[SUCCESS] ${message}`));
    }
    /**
     * Log a warning message
     */
    warning(message) {
        console.log(chalk_1.default.yellow(`[WARNING] ${message}`));
    }
    /**
     * Log an error message
     */
    error(message) {
        console.error(chalk_1.default.red(`[ERROR] ${message}`));
    }
    /**
     * Log a debug message (only in debug mode)
     */
    debug(message) {
        if (process.env.DEBUG) {
            console.log(chalk_1.default.gray(`[DEBUG] ${message}`));
        }
    }
}
exports.Logger = Logger;
