import { TriangleTest } from './test/model/TriangleTest.js';
import { runTests } from './Tester.js';
import { Logger } from "../utils/Logger.js";
import { GameSerializerTest } from "./test/serializer/GameSerializerTest.js";
import { ActionSerializerTest } from './test/serializer/ActionSerializerTest.js';
import { BoardServiceTest } from './test/service/BoardServiceTest.js';

Logger.setLevel(0);

TriangleTest();
GameSerializerTest();
ActionSerializerTest();
BoardServiceTest();

runTests();