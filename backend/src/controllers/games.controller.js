/**
 * Controller for managing all game-related API requests.
 */
const gameService = require('../services/game.service');
const audit = require('../services/audit.service');

const getGames = async (req, res, next) => {
  try {
    const result = await gameService.listGames();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getRecentGames = async (req, res, next) => {
  try {
    const rawPage = req.query.page;
    const rawLimit = req.query.limit;
    const rawCursor = req.query.cursor;

    const parsedPage = rawPage === undefined ? 1 : parseInt(rawPage, 10);
    const parsedLimit = rawLimit === undefined ? 10 : parseInt(rawLimit, 10);
    const cursor = rawCursor === undefined ? undefined : parseInt(rawCursor, 10);

    const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const limit = Number.isNaN(parsedLimit) || parsedLimit < 1 ? 10 : parsedLimit;

    if (cursor !== undefined && (Number.isNaN(cursor) || cursor < 1)) {
      const error = new Error('Query parameter "cursor" must be a positive integer.');
      error.statusCode = 400;
      error.code = 'INVALID_QUERY_PARAM';
      throw error;
    }

    const { gameType, status, sortBy, sortDir } = req.query;

    const result = await gameService.getRecentGames({
      page,
      limit,
      cursor: cursor === undefined ? undefined : String(cursor),
      gameType,
      status,
      sortBy,
      sortDir,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const playSimpleGame = async (req, res, next) => {
  try {
    const { gameType, _amount, _choice } = req.body;
    const result = await gameService.playSimpleGame({
      userId: req.user.id,
      gameType,
    });
    res.status(200).json(result);
    audit.log({
      actor: req.user.id,
      action: 'game.play',
      target: gameType,
      payload: { gameType },
      outcome: 'success',
    });
  } catch (error) {
    audit.log({
      actor: req.user?.id || 'anonymous',
      action: 'game.play',
      target: req.body?.gameType || 'unknown',
      outcome: 'failure',
      metadata: { error: error.message },
    });
    next(error);
  }
};

module.exports = {
  getGames,
  getRecentGames,
  playSimpleGame,
};
