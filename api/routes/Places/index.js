const express = require('express');
const axios = require('axios');
const googleMapsClient = require('@google/maps').createClient({
  key: process.env.PLACES_API_KEY,
  Promise,
});

const mock = require('../../middleware/mock');
const cityData = require('../../../mock/dev/city');
const infoData = require('../../../mock/dev/info');

const router = express.Router();

const checkCache = async (req, res, next) => {
  /*

    Client sends text query
    Lookup query in alias table

    Does query exist in alias table
    | Yes => get referenced destination id
    | No => Make findPlace query to get place_id
      | Does response types include 'locality'
        | No => What do? Send Error? Just continue without caching as destination?
          | Find out what city the attraction is in and save as an alias
        | Yes => Continue
      | Does place_id exist in destination table
        | Yes => Add alias reference to destination
        | No => Add new entry in destination table and alias reference
      | Return long/lat array

      destination
      | id  | place_id |  name |  lng | lat |
      | 1  | alskdfj | New York | 000 | 000 |
      | 2   | lsksdj | San Francisco | 111 | 111 |

      alias
      | id  | name | destination_id |
      | 1   | 'New York' | 1  |
      | 2   | 'New York City' | 1 |
      | 3   | 'San Fran' | 2
      | 4   | 'Golden Gate Bridge' | 2
      | 5   | 'Statue of Liberty' | 1

  */
  next();
};

router.get('/details/:city', mock(cityData), checkCache, async (req, res) => {
  try {
    const { params } = req;
    const { json: { candidates } } = await googleMapsClient.findPlace({
      input: params.city,
      inputtype: 'textquery',
      language: 'en',
      fields: ['geometry', 'types', 'name'],
    }).asPromise();

    // pulls the longitude/latitude off the first candidate in the response
    const { geometry: { location }, name: cityName } = candidates[0];

    const { json: { results } } = await googleMapsClient.places({
      query: 'stuff to do',
      location: Object.values(location),
      language: 'en',
    }).asPromise();

    const places = await Promise.all(results.filter(({ photos }) => photos).map(async ({
      name,
      place_id: placeId,
      price_level: price,
      photos,
      rating,
      types,
      user_ratings_total: totalRatings,
    }) => {
      let picture = '';

      const picRef = photos[0].photo_reference;
      const pictureReq = await googleMapsClient.placesPhoto({
        photoreference: picRef,
        maxwidth: 400,
      }).asPromise();

      picture = `https://${pictureReq.connection._host}${pictureReq.req.path}`; // eslint-disable-line

      return {
        name,
        placeId,
        price,
        rating,
        types,
        picture,
        totalRatings,
      };
    }));

    res.send({
      status: 'success',
      cityName,
      places: places.sort((a, b) => (b.rating - a.rating)),
    });
  } catch (error) {
    console.log(error); //eslint-disable-line
    res.send(error);
  }
});

router.get('/info/:attraction', mock(infoData), async (req, res) => {
  try {
    const { params } = req;
    const endpoint = 'https://kgsearch.googleapis.com/v1/entities:search';
    const { data: { itemListElement } } = await axios.get(endpoint, {
      params: {
        query: params.attraction,
        key: process.env.PLACES_API_KEY,
        limit: 1,
        indent: true,
        types: 'Place',
      },
    });
    const { result: { detailedDescription: { articleBody: description } } } = itemListElement[0];
    res.json({
      status: 'success',
      description,
    });
  } catch (error) {
    console.log(error); // eslint-disable-line
    res.status(500).json({
      status: 'error',
      message: 'Unknown server error',
    });
  }
});

module.exports = router;