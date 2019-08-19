const express = require('express');
const graphql = require('express-graphql');
const { buildSchema } = require('graphql');

const userDb = require('../mock/users')(30);

// GraphQL buildSchema
const schema = buildSchema(`
    type Query  {
        message: String,
        user(id: String!): User,
        users: [User]
    },
    type User {
      id: String,
      name: String,
      email: String,
      itineraries: [Itinerary],
    },
    type Itinerary {
      id: String,
      attractions: [Attraction],
    },
    type Attraction {
      id: Int,
      placeId: String,
      name: String,
      description: String,
      lat: String,
      lng: String,
      address: String,
      phone: String,
      price: Int,
      rating: Float,
      numRatings: Int,
    }
`);

// resolvers
const root = {
  message: () => 'Hello World',
  user: ({ id }) => userDb.find(user => user.id === id),
  users: () => userDb,
};

const db = require('../database/models')('user');

const nou = async (req, res, next) => {
  const users = await db.get();
  res.json({
    users,
    message: 'test',
  });
};

const m = require('../api/auth/token');

// Create an express server and GraphQL endpoint
const app = express.Router();

app.use('/test', m, nou, graphql({
  schema,
  rootValue: root,
  graphiql: true,
}));

app.use('/', graphql({
  schema,
  rootValue: root,
  graphiql: true,
}));

module.exports = app;
