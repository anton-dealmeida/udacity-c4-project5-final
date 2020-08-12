import * as AWS from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { TodoItem } from '../models/TodoItem'
import { UpdateTodoRequest } from '../requests/UpdateTodoRequest'
import { createLogger } from '../utils/logger'

const logger = createLogger('auth')

const XAWS = AWSXRay.captureAWS(AWS)

export class TodoAccess {
    constructor(
        private readonly docClient: DocumentClient = new XAWS.DynamoDB.DocumentClient(),
        private readonly todosTable = process.env.TODOS_TABLE,
        private readonly createdAtIndex = process.env.CREATED_AT_INDEX
    ) { }

    async createTodo(todo: TodoItem): Promise<TodoItem> {
        await this.docClient
            .put({
                TableName: this.todosTable,
                Item: todo
            }, function (err, data) { err ? logger.info(`Error: ${err}`) : logger.info(`Success: ${data}`) })
            .promise()

        logger.info(`Saved new todo item ${todo.todoId} for user ${todo.userId}`)

        return todo
    }

    async getTodos(userId: string): Promise<TodoItem[]> {
        logger.info(`Querying ${this.todosTable} on ${this.createdAtIndex} for todos of user ${userId}`)

        const result = await this.docClient
            .query({
                TableName: this.todosTable,
                IndexName: this.createdAtIndex,
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': userId
                }
            }, function (err, data) { logger.info(`Query returned: ${err ? err : data}`) })
            .promise()

        logger.info(`Found ${result.Count} todo items for user ${userId}`)

        const items = result.Items

        return items as TodoItem[]
    }

    async updateTodo(userId: string, todoId: string, updatedTodo: UpdateTodoRequest) {
        await this.docClient.update({
            TableName: this.todosTable,
            Key: {
                todoId,
                userId
            },
            UpdateExpression: 'set #name = :n, #dueDate = :due, #done = :d',
            ExpressionAttributeValues: {
                ':n': updatedTodo.name,
                ':due': updatedTodo.dueDate,
                ':d': updatedTodo.done
            },
            ExpressionAttributeNames: {
                '#name': 'name',
                '#dueDate': 'dueDate',
                '#done': 'done'
            }
        }, function (err, data) { err ? logger.info(`Error! Failed to updated ${todoId} for ${userId}.\nMore info: ${err}`) : logger.info(`Success! Updated ${todoId} for user ${userId}.\nMore info:${data}`) })
            .promise();
    }

    async deleteTodo(userId: string, todoId: string) {
        logger.info(`Deleting todoId: ${todoId} for userId: ${userId}`)
        await this.docClient.delete({
            TableName: this.todosTable,
            Key: {
                userId,
                todoId
            }
        }, function (err, data) { err ? logger.info(`Error! Failed to delete ${todoId} for ${userId}.\nMore info: ${err}`) : logger.info(`Success! Deleted ${todoId} for user ${userId}.\nMore info:${data}`) })
            .promise()
    }
}