import { ShellColors } from '../../ressources/ShellColors.js'

class Tester {
    constructor() {
        this.tests = [];
        this.results = { passed: 0, failed: 0 };
    }

    test(description, fn) {
        this.tests.push({ description, fn });
    }


    assert(condition) {
        if (!condition) {
            throw new Error('Assertion failed ' + condition);
        }
    }

    assertEqual(actual, expected, message) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(
                message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
            );
        }
    }

    async run() {
        for (const test of this.tests) {
            try {
                await test.fn();
                console.log(`${ShellColors.brightGreen}✓ pass${ShellColors.reset}...${test.description}`);
                this.results.passed++;
            } catch (error) {
                console.log(`${ShellColors.brightRed}✗ fail${ShellColors.reset}...${test.description}`);
                console.log(ShellColors.red + "- " + error);
                this.results.failed++;
            }
        }

        const allPassed = this.results.failed === 0;
        const resultColor = allPassed ? ShellColors.brightGreen : ShellColors.brightRed;
        const statusIcon = allPassed ? '✓' : '✗';

        console.log(`\n${resultColor}${statusIcon} Results: ${ShellColors.reset}${ShellColors.green}${this.results.passed} passed${ShellColors.reset}, ${this.results.failed > 0 ? ShellColors.red : ShellColors.dim}${this.results.failed} failed${ShellColors.reset}`);

        return allPassed;
    }

}

const runner = new Tester();
export const test = runner.test.bind(runner);
export const assert = runner.assert.bind(runner);
export const assertEqual = runner.assertEqual.bind(runner);
export const runTests = runner.run.bind(runner);
