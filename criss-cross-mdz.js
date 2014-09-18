// If we're out of gold, there's nothing to do
if(this.gold === 0) return null;

this.curTurn = this.turns.length;
//////////////////////////////////////////////////////////////////////////////
/////  Debug filters

this.debugLoss = false;
this.debugBehav = false;//(this.round === -1 && this.turn === 5);
this.debugPath = false;//(this.round === 0 && this.curTurn == 16);
this.debugScores = false;

this.debugJunk = false;
this.debugJunk1 = false;

this.debugCalcBid = false;//(this.round === 3);
this.debugHighlight = false;

// One word for debug disable
if(true)
{
    this.debugLoss = false;
    this.debugBehav = false;
    this.debugPath = false;
    this.debugScores = false;
    this.debugCalcBid = false;
    this.debugHighlight = false;
    this.debugJunk = false;
    this.debugJunk1 = false;
}

this.debugAny = this.debugLoss || this.debugBehav || this.debugPath || this.debugScores ||
                this.debugJunk || this.debugJunk1 || this.debugCalcBid || this.debugHighlight;

//////////////////////////////////////////////////////////////////////////////

var HORIZ = true;
var VERT = false;

var myDir = this.team == "humans" ? HORIZ : VERT;
var opDir = !myDir;

var BFS_WAIT = 4;
if(this.round == 2)
    BFS_WAIT = 20;

this.tgl = tileGroupLetter;
this.tgli = "ABCDEFG".indexOf(tileGroupLetter);

/**
 * The solution implementation will be written from the perspective of the humans,
 * but these accessors will make it work for both. Just make sure to use these
 * instead of direct access to x & y coordinates :)
 */

 
var x;
var y;

if(myDir === HORIZ)
{
    x = function(tile) {
        return tile.x;
    };

    y = function(tile) {
        return tile.y;
    };
} else {
    x = function(tile) {
        return tile.y;
    };

    y = function(tile) {
        return tile.x;
    };
}

function otherOptions(xy, neighbor) {
    var x1 = neighbor.x;
    var y1,y2;
    switch(xy.y - neighbor.y) {
    case -1:
        y1 = xy.y-1;
        y2 = xy.y;
        break;
    case 0:
        y1 = xy.y-1;
        y2 = xy.y+1;
        break;
    case 1:
        y1 = xy.y;
        y2 = xy.y+1;
        break;
    }
    return [{x: x1, y: y1},{x: x1, y:y2}];
}

function mine(tile)
{
    return tile.owner == (myDir ? "humans" : "ogres");
}

function theirs(tile)
{
    return tile.owner == (myDir ? "ogres" : "humans");
}

this.percentile = function(arr, pct)
{
    if(arr.length === 0) return 0;
    else if(arr.length == 1) return arr[0];
    
    // We can't use slice() here because API protection makes sort() a no-op.
    var sorted = [];
    for(var i=0;i<arr.length;++i)
        sorted.push(arr[i]);
    
    sorted.sort();
    var idx = pct*(sorted.length-1);
    if(idx > 0) {
        idx = Math.ceil(idx);
        return Math.ceil(0.5*(sorted[idx] + sorted[idx-1]));
    }
    return sorted[idx];
};

function avg(arr)
{
    if(arr.length === 0) return 0;
    else if(arr.length == 1) return arr[0];
    
    var sum = arr.reduce(function(a,b) { return a+b;});
    return Math.ceil(sum/arr.length);
}

function clamp(value, min, max)
{
    return Math.max(min, Math.min(value,max));
}



//// INIT
if(this.round === 0 && this.curTurn === 0) {

    this.debug("**** GOOD LUCK! -- mdz, "+this.team+" ****");

    //////////////////////////////////////////////////////////////////////////////
    /////  Some constants
    
    this.zeros =
       [0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,
        0,0,0,0,0,0,0];
        
    this.junkReset = [[false,false,false,false,false,false,false],
                [false,false,false,false,false,false,false],
                [false,false,false,false,false,false,false],
                [false,false,false,false,false,false,false],
                [false,false,false,false,false,false,false],
                [false,false,false,false,false,false,false],
                [false,false,false,false,false,false,false]];

    //////////////////////////////////////////////////////////////////////////////
    /////  Main methods
    
    /**
     * Initialize function pointers, and everything used during path calculation.
     *
     * This is needed because I only do the expensive stuff after the first few turns.
     * Don't want to build and step through 3300+ paths just to find out that
     * I like tiles close to the middle :)
     */
    this.turn_init = function() {
        
        if(this.curTurn === 0) {
            // Lucky 16 on the first turn of the first round :)
            this.calcBid = function() { return 16; };
        
            // skeltoac bug..
            //this.initMyTiles();
            
            // Quick and dirty, but good enough
            this.scoreFunc = this.firstTurnScore;
            
            this.junk = this.myClone(this.junkReset);
            
            this.bidding_init = function() {};
            this.interestFunc = function() { return 0; };
            // Cheap Urgency = how many tiles they have vs how many tiles I have
            this.urgencyFunc = function() { return this.opponentTiles.length - this.myTiles.length; };
            this.mtbFunc = function() { return Math.ceil(this.opGold / (7-this.opponentTiles.length)); };
            this.usefulFunc = function() {};
            
            this.ranBFS = false;
            this.bfsTiles = null;
            this.opBfsTiles = null;
            
            
        } else if((this.myTiles.length < 2 && this.opponentTiles.length < 4) ||
                  (this.myTiles.length < 5 && this.opponentTiles.length < 3)) {
            this.ranBFS = false;
            this.scoreFunc = this.quickAndDirty;
            this.bidding_init = this.bidding_initFunc;
            this.calcBid = this.calcBidFunc;
            
            if(this.tilesOwned.length > 0) {
                var lastBoughtTile = this.tilesOwned[this.tilesOwned.length - 1];
                this.updateUninterestingTiles(lastBoughtTile);
            }
        } else {
            if(!this.ranBFS) {
                this.ranBFS = true;
                this.scoreFunc = this.d_detailedScore;
                this.interestFunc = function(tile) { return this.opBfsTiles.pathCounts[tile.y*7+tile.x]; };
                // Real Urgency = How many tiles I need vs how many tiles they need
                this.urgencyFunc = function() { return this.bfsTiles.shortestLength - this.opBfsTiles.shortestLength; };
                this.mtbFunc = function() {return Math.ceil(this.opGold / (this.opBfsTiles.shortestLength));};
                this.usefulFunc = this.showUsefulTiles;
            }
            
            // Do the path calculations for me and opponent
            this.bfsTiles = this.findShortestPaths(myDir);
            this.opBfsTiles = this.findShortestPaths(opDir);
            
            if(this.debugPath) this.debug("PathInfo",this.bfsTiles,this.opBfsTiles);
        }
    };
    
    /**
     * Score every neutral tile in the current tileLetterGroup.
     */
    this.scoreTiles = function() {
        var scoredTiles = [];
        var opInterest = 0;
        var endGame = false;
        // tiles available this turn with no owner...
        
        // Whenever skeltoac bug is fixed, just use tileGroups.
        var tiles = this.tileGroups[this.tgl].filter(function(tile) { return !tile.owner;});
        //var tiles = this.myTileGroups[this.tgli].filter(function(tile) { return !tile.owner;});
        
        for(var i in tiles)
        {
            var tScore = this.scoreFunc(tiles[i]);
            opInterest = Math.max(opInterest,  this.interestFunc(tiles[i]));
            
            endGame |= tScore.endgame;
            var st = {score: tScore, tile: tiles[i]};
            scoredTiles.push(st);
        }
        this.wasEndgame = endGame;
        // Sort descending
        scoredTiles.sort(function(a,b) { return b.score.score - a.score.score; });
    
        //if(this.debugScores) this.debug("Scored Choices",scoredTiles);
        return {
            endGame: endGame,
            opInterest: opInterest,
            scoredTiles: scoredTiles
        };
    };
    
    /**
     * Put it all together. Come up with my bid, or null if we're passing this round.
     */
    this.finalSolution = function(choices) {
        if(choices.scoredTiles[0].score.score > 0 || choices.endGame)
        {
            var myBid = this.calcBid(choices);
            if(myBid === null || myBid <= 0)
                return null;
            return {gold: myBid, desiredTile: choices.scoredTiles[0].tile};
        } else {
            return null;
        }
    };    
   
    
    //////////////////////////////////////////////////////////////////////////////
    /////  Path Calculations
    
    
    /**
     * This is the meaty part of tile evaluation.
     *
     * 1) Use Dijkstra's Algorithm (BFS) to find all shortest paths from start to goal.
     *    - The cost of adding a neutral tile to a path is 1; the cost of a tile I own is 0.
     *    - When visiting each tile, remember which of its neighbor tile(s) got you there ("parents")
     *    - The minimum number of tiles that I need to purchase is known as "shortestLength".
     *
     * If we pass in an "excludedTile", then we just want to calculate shortestLength while pretending we
     * can't use the tile in question.
     *
     * 2) Using parent records from (1), use DFS to count how many "unique" paths each neutral tile is used in.
     *    Additionally, count how many "quick" paths each tile is used in.
     *     - A path's uniqueness is determined by the set of neutral tiles it uses
     *     - The only way there could be duplicate paths is if I own any "inefficient" tiles.
     *       This is true iff:
     *         The number of tiles I currently own + shortestLength > 7
     *     - A "quick" path is defined as a path that would take the fewest *turns* to purchase.
     *
     * 3) Using parent records from (1), collect all neutral tiles used in any shortest path.
     *    This represents the list of tiles that are "useful" to me (or the opponent, depending on "dir" parameter).
     *
     * Notes:
     *     - Quickness could be a useful metric, and I'm using it to break ties.. but that's it so far
     *
     * @param dir           The perspective from which to run the calculation; myDir or opDir
     * @param excludedTile  If set, calculate shortestLength if this tile is not used.
     */
    this.findShortestPaths = function(dir, excludedTile)
    {
    
        // Convenience methods
        var dirMine = dir == myDir ? mine : theirs;
        var dirTheirs = dir == myDir ? theirs : mine;
        var mx = (dir == myDir ? x : y);
        
        //////////////////////////////////////////////////////
        ///////////// PART 1: Dijkstra BFS
        //////////////////////////////////////////////////////
        
        var pathState = {};
        var queueX = [];
        var queueN = [];
        
        for(var i=0;i<7;++i) {
            for(var j=0;j<7;++j) {
                var t = this.myGetTile(i,j,dir);
                if(dirTheirs(t) || excludedTile === t.id) continue;
                var cost = 50;
                var node;
                if(i === 0) {
                    cost = dirMine(t) ? 0 : 1;
                    node = {cost: [cost], tile: t, parents: []};
                    if(dirMine(t))
                        queueX.push(t.id);
                    else
                        queueN.push(t.id);
                }
                else {
                    node = {cost: [cost], tile: t, parents: []};
                }
                pathState[t.id] = node;
            }
        }
        
        var curCost = 1;
        var curParent = null;
        var shortestLength = null;
        var reachedTargets = [];
        var seenX = [];
        while(queueX.length > 0 || queueN.length > 0)
        {
            var isX;
            // Clear the X queue first
            if(queueX.length > 0) {
                isX = true;
                node = pathState[queueX.shift()];
                seenX.push(node.tile.id);
            } else {
                isX = false;
                node = pathState[queueN.shift()];
                curCost = node.cost[0] + 1;
                curParent = node;
                seenX = [];
            }
                        
            if(mx(node.tile) == 6) {
                // We've reached the end.
                if(!shortestLength) {
                    if(curParent)
                        shortestLength = curParent.cost[0];
                    else
                        shortestLength = 0;
                    
                    // If we're excluding a tile, all we care about is the shortest cost.
                    if(excludedTile)
                        return shortestLength;
                } else if(shortestLength < curParent.cost[0]) {
                    break;
                }
                reachedTargets.push(curParent.tile.id);
                continue;
            } else if(shortestLength && shortestLength < curParent.cost[0]) {
                // We no longer need to explore, because the remaining tiles in the queue
                // represent paths that cost more than the shortest.
                break;
            }
            
            for(i=0;i<node.tile.neighbors.length;++i)
            {
                var tn = node.tile.neighbors[i];
                if(dirTheirs(tn) || excludedTile === tn.id || pathState[tn.id].cost[0] < curCost)
                    continue;
                else if(pathState[tn.id].cost[0] > curCost) {
                    // We've found a faster way to reach this node
                    pathState[tn.id].cost.unshift(curCost);
                    // Explore its neighbors!
                    if(dirMine(tn))
                        queueX.push(tn.id);
                    else {
                        queueN.push(tn.id);
                        if(curParent !== null)
                        {
                            pathState[tn.id].parents.push(curParent);
                        }
                    }
                }
                else if(pathState[tn.id].cost[0] === curCost &&
                        curParent !== null) {
                    if(dirMine(tn) && seenX.indexOf(tn.id) == -1)
                        // Explore X's child nodes to add me as a parent
                        queueX.push(tn.id);
                    else
                        // We've found an equally good path to reach this neutral node
                        pathState[tn.id].parents.push(curParent);
                }
            }
        }
        
        // If we're calculating the cost of excluding this tile, and we can't reach the goal without it,
        // Then the cost is +Infinity. But let's just return a big number :)
        if(excludedTile && !shortestLength)
            return 50;
        
        // API Protection inconvenience, I think. Or I just don't understand some parts of javascript
        var rt2 = [];
        for(var idx in reachedTargets)
        {
            rt2.push(pathState[reachedTargets[idx]]);
        }
        reachedTargets = rt2;
        
        //////////////////////////////////////////////////////
        ///////////// PART 2: DFS for Unique Path Counting
        //////////////////////////////////////////////////////
        
        this.totalPaths = 0;
        
        this.quickestPathTime = 7*shortestLength - 1;
        this.quickestPathCount = 1;
        
        this.quickPathCounts = this.reset49();
        this.pathCounts = this.reset49();
        
        for(var rt in reachedTargets)
        {
            this.dfsPathCount(reachedTargets[rt]);
        }
        
        if(this.debugPath) this.debug((dir == myDir ? "[ME] ":"[OP] ")+
                "[L: "+shortestLength+", #: "+this.totalPaths+"]; [Q: "+
                this.quickestPathTime+", #: " + this.quickestPathCount +"]");
        
        // Normalize
        for(idx = 0; idx < 49; ++idx)
        {
            this.pathCounts[idx] /= this.totalPaths;
            this.quickPathCounts[idx] /= this.quickestPathCount;
        }
        
        // Count important tiles
        var numImportant = this.tileGroups[this.tgl].filter(function(tile) {
            return !dirMine(tile) && !dirTheirs(tile) &&
                    this.pathCounts[tile.y*7+tile.x] == 1; }, this).length;
        
        return {
                shortestLength: shortestLength,
                numImportant: numImportant,
                totalPaths: this.totalPaths,
                pathCounts: this.pathCounts.slice(),
                quickPathCounts: this.quickPathCounts.slice(),
                quickPathTime: this.quickestPathTime,
                quickPathCount: this.quickestPathCount
                };
    };

    /**
     * Calculate how many turns must pass before purchasing all of the tiles
     *
     * @param tiles Array of tile group letters, representing the tiles themselves
     * @return How many turns it would take to buy them all
     */
    this.calcPathTime = function(tiles)
    {
        var abc = "ABCDEFG";
        var turns = [];
        for(var i in tiles)
        {
            if(tiles[i].owner) continue;
            var turnNum = abc.indexOf(tiles[i].tileGroupLetter);
            turnNum = (turnNum + 7 - abc.indexOf(this.tgl)) % 7;
            turns.push(turnNum);
        }
        
        turns.sort();    
        var prevGroup = -1;
        var time = 0;
        var waitTime = 0;
        for(i in turns)
        {
            if(turns[i] == prevGroup)
                waitTime += 7;
            else {
                waitTime = 0;
                prevGroup = turns[i];
            }
            time = Math.max(turns[i] + waitTime, time);
        }
        return time;
    };
    
    /**
     * Recursively explore the parent records tree structure built in Part (1) of findShortestPaths().
     * Count how many paths use each tile. The more times a tile is used, the more valuable it is.
     *
     * Note: If a tile is used in *every* path, that means if the opponent buys this tile, then our
     *       shortest path length will go up by at least 1. See lossPenalty in d_detailedScore().
     */
    this.dfsPathCount = function(node, fullPath) {
        if(!fullPath)
            fullPath = [];

        if(node.parents.length === 0) {
            // We've reached the end of a new path
            
            ++this.totalPaths;
            fullPath.push(node.tile);
            
            var pathTime = this.calcPathTime(fullPath);
            if(pathTime < this.quickestPathTime)
            {
                this.quickPathCounts = this.reset49();
                this.quickestPathTime = pathTime;
                this.quickestPathCount = 1;
            } else if(pathTime == this.quickestPathTime)
            {
                ++this.quickestPathCount;
            }
            
            for(var nodeIdx in fullPath)
            {
                var pcIdx = fullPath[nodeIdx].y*7 + fullPath[nodeIdx].x;
                this.pathCounts[pcIdx]++;
                if(pathTime == this.quickestPathTime)
                    this.quickPathCounts[pcIdx]++;
            }
        } else {
            fullPath.push(node.tile);
            var seenParents = [];
            for(var p in node.parents)
            {
                if(seenParents.indexOf(node.parents[p].tile.id) > -1)
                    continue;
                this.dfsPathCount(node.parents[p], fullPath);
                seenParents.push(node.parents[p].tile.id);
            }
        }
        fullPath.pop();
    };
    
    //////////////////////////////////////////////////////////////////////////////
    /////  Tile Scoring
    
    /**
     * Used to score tiles in round 0, turn 0
     */
    this.firstTurnScore = function(tile) {
        var scores = [[0.1,0.2,0.3,0.4,0.3,0.2,0.1],
                    [0.2,0.5,0.6,0.7,0.6,0.5,0.2],
                    [0.3,0.6,0.8,0.9,0.8,0.6,0.3],
                    [0.4,0.7,0.9,1.0,0.9,0.7,0.4],
                    [0.3,0.6,0.8,0.9,0.8,0.6,0.3],
                    [0.2,0.5,0.6,0.7,0.6,0.5,0.2],
                    [0.1,0.2,0.3,0.4,0.3,0.2,0.1]];

        var ret = {
            usefulness: scores[tile.y][tile.x],
            quickness: 0,
            lossPenalty: 0,
            opUsefulness: 0,
            opQuickness: 0,
            opLossPenalty: 0,
            endgame: 0,
            score: scores[tile.y][tile.x]
        };
        return ret;
    };
    
    /**
     * At the beginning of the game, focus on:
     *  - The bow-tie of reachability
     *  - Connecting adjacent tiles
     *  - Blocking opponent moves
     *  - Low-value tie breaker: being closer to the center of the board
     */
    this.quickAndDirty = function(tile)
    {
        var dx = x(tile) - 3;
        var dy = y(tile) - 3;
        // Don't need the sqrt call here, order stays the same
        var cDist = (dx*dx + dy*dy)/100.0;
        
        // Check if op is already blocking
        var junkTile = this.junk[x(tile)][y(tile)];
        
        var score = 0;
        if(!junkTile)
        {
            var maxDyOfMinDx = 0;
            var minDx = 7;
            var neighborCount = 0;
            var neighborDy = 0;
            var neighbors = [];
            
            for(var i in this.myTiles)
            {
                var t = this.myTiles[i];
                dy = Math.abs(y(t) - y(tile));
                dx = Math.abs(x(t) - x(tile));

                if(Math.max(dy,dx) == 1) {
                    ++neighborCount;
                    neighborDy += dy;
                    neighbors.push({x: x(t), y: y(t)});
                }
                if(dx <= minDx)
                {
                    minDx = dx;
                    maxDyOfMinDx = Math.max(maxDyOfMinDx, dy);
                }
            }
            
            var avoidBlock = 0;
            if(neighborCount == 1)
            {
                var options = otherOptions({x: x(tile), y: y(tile)}, neighbors[0]);
                if(options.every(function(xy) { return this.junk[xy.x][xy.y]; }, this))
                    avoidBlock = 5;
            } else if(neighborCount == 2 && neighborDy  == 1)
            {
                var options1 = otherOptions({x: x(tile), y: y(tile)}, neighbors[0]);
                var options2 = otherOptions({x: x(tile), y: y(tile)}, neighbors[1]);
                
                // TODO calculate intersection of options, then check against junk
                var intersection = [];
            }
            
            var centered = 0.2 * (5 - maxDyOfMinDx);
            
            var opSameCol = this.opponentTiles.filter(function(t) { return x(t) === x(tile); }).length;
            var iDontBlock = this.opponentTiles.some(function(t) { return Math.abs(x(t) - x(tile)) == 1 && y(t) === y(tile); });
            
            var iDoBlock = false;
            if(!iDontBlock)
            {
                var above = this.opponentTiles.filter(function(t) { return y(t) - y(tile) == 1;});
                var below = this.opponentTiles.filter(function(t) { return y(t) - y(tile) == -1;});
                if(above.length == 1 && below.length == 1)
                {
                    // If the sum of the dx's is zero, and neither dx is equal to zero, then this tile blocks a diagonal!
                    var dx1 = x(above[0]) - x(tile);
                    var dx2 = x(below[0]) - x(tile);
                    iDoBlock = dx1 + dx2 === 0 && dx1 !== 0;
                }
            }
            if(neighborCount == 2)
                score = 4 * neighborCount + neighborDy;
            else if(neighborCount == 1)
                score = 4 * neighborCount + avoidBlock + 3-Math.abs(y(t) - 3);
            else
                score = (3 - cDist + centered);
                
            // TODO how much should iBlockOp be worth?
            if(iDoBlock) score += 2;
            
            /*
            Score Classes:
                junk:
                 0
                two neighbors:
                 8 + [0,2]
                one neighbor:
                 4 + [0,3]
                no neighbors:
                 3 - [0,1] - [0,1]
                

                blocking bonus: 2
                max score: 12
            */
            
            score /= 12;
            
        }
        
        if(false && this.debugScores) this.debug("Quickie score info "+tile.id,
            {   neighborCount: neighborCount,
                neighborDy: neighborDy,
                yDist: 3-Math.abs(y(t) - 3),
                cDist: cDist,
                maxDyOfMinDx: maxDyOfMinDx,
                opBlocks: opBlocksMe,
                iBlock: iBlockOp
            });
        
        var ret = {
            usefulness: score,
            quickness: 0,
            lossPenalty: 0,
            opUsefulness: 0,
            opQuickness: 0,
            opLossPenalty: 0,
            endgame: 0,
            score: score
        };
        return ret;
    };
    
    /**
     * Calculate the overall desirability of a tile. This is broken down in to
     * a number of components, each of which can be weighted differently.
     * Ideally, I'd use some machine learning to optimize the weights, but
     * 1) I haven't done that in years, and
     * 2) Maybe I can intuit some good-enough weights on my own :)
    */
    this.d_detailedScore = function(tile) {
        var score = 0;
        var endgame = this.d_endGame(tile);
        
        var usefulness = this.bfsTiles.pathCounts[tile.y*7+tile.x];
        var quickness  = this.bfsTiles.quickPathCounts[tile.y*7+tile.x];
        var lossPenalty = 0;
        
        var opUsefulness = this.opBfsTiles.pathCounts[tile.y*7+tile.x];
        var opQuickness  = this.opBfsTiles.quickPathCounts[tile.y*7+tile.x];
        var opLossPenalty = 0;
        
        if(endgame > 1) {
            // If this tile will make us win, that's all we need to know
            score = endgame;
        } else if(usefulness === 0 && (this.bfsTiles.shortestLength == this.gold || this.opGold === 0)) {
            // Don't allow yourself to bid on frivolous tiles when you can only afford
            // 1 gold per remaining *necessary* tile, or the opponent is out of gold
            score = 0;
        } else{
            if(usefulness == 1) {
                // Bonus points based on how many extra tiles I'd have to buy if
                // I can't have this one
                lossPenalty = this.bfsTiles.numImportant  > 1 ?
                    this.findShortestPaths(myDir, tile.id) - this.bfsTiles.shortestLength :
                    1;
            }
            
            
            if(opUsefulness == 1) {
                // Maybe try to make OP buy at least an additional tile!
                opLossPenalty = this.opBfsTiles.numImportant  > 1 ?
                    this.findShortestPaths(opDir, tile.id) - this.opBfsTiles.shortestLength :
                    1;
                //opLossPenalty = this.findShortestPaths(opDir, tile) - this.opBfsTiles.shortestLength;
            }
            
            score += usefulness;
            score += 0.05 * quickness;
            score += 0.25 * opUsefulness;
            score += lossPenalty * 0.25;
            score += opLossPenalty * 0.1;
        }
        
        if(this.debugLoss && (lossPenalty > 0 || opLossPenalty > 0))
            this.debug("(U, Q, P) (oU, oQ, oP)",tile.id,
            "("+usefulness.toPrecision(4)  +", "  +quickness.toPrecision(4)+", "+ lossPenalty+")",
            "("+opUsefulness.toPrecision(4)+", "+opQuickness.toPrecision(4)+", "+ opLossPenalty+")");
        
        var ret = {
            usefulness: usefulness,
            quickness: quickness,
            lossPenalty: lossPenalty,
            opUsefulness: opUsefulness,
            opQuickness: opQuickness,
            opLossPenalty: opLossPenalty,
            endgame: endgame,
            score: score
        };
        
        return ret;
    };
    
    /**
     * Check if this tile would win the game for either player.
     * If it's a win, return +Infinity (we want this tile no matter what)
     * If it's a loss, return 1 to indicate that we definitely want
     * to bid on *something* this round, and beat the opponent's bid if possible.
     */
    this.d_endGame = function(tile) {
        // No endgames before one of us has 6 tiles
        if(this.opponentTiles.length < 6 && this.myTiles.length < 6) return 0;
        
        if(this.bfsTiles.shortestLength == 1 &&
            this.bfsTiles.pathCounts[tile.y*7+tile.x] > 0)
            return Number.POSITIVE_INFINITY;
        
        if(this.opBfsTiles.shortestLength == 1 &&
            this.opBfsTiles.pathCounts[tile.y*7+tile.x] > 0)
            return 1;
            
        return 0;
    };
    
    //////////////////////////////////////////////////////////////////////////////
    /////  Bidding Calculations
    
    /**
     * Calculate and record some information about the opponent's bidding behavior.
     *
     * This is pretty messy, redundant, and not well thought out at the moment.
     */
    this.bidding_initFunc = function() {
        if(!this.behavior)
        {
            this.behavior = {
                tieBreaker: [1],
                endGameAware: [false],
                urgency: [0],
                bidBuckets: {
                    allBids: [],
                    turnZero: [],
                    early: [],
                    noneOwned: [],
                    noInterest: [],
                    clutch: [],
                }
            };
            this.bidValues = {
                turnZero: 16,
                standard: 16,
                clutch: 20,
                noInterest: 3,
                boring: -1
            };
        }
        
        var prevGold = this.curTurn > 1 ? this.getGold(this.turns[this.curTurn-2]) : [128,128];
    
        // We have to use a clone and overwrite because of the API protection stuff.. weird and annoying
        var behav = this.myClone(this.behavior);
        
        // This will only ever be called after turn 0, so we can safely refer to curTurn-1
        var turn = this.turns[this.curTurn-1];
        var opBid = this.getBidValue(turn, opDir);
        var myBid = this.getBidValue(turn, myDir);
        this.opGold = this.getGold(turn)[1];

        // Look at the latest turn to see if the opponent knows how to bid at endgame
        if(this.wasEndgame) {
            var goodBid = Math.min(prevGold[0] + 1 - behav.tieBreaker[0], prevGold[1]);
            behav.endGameAware.unshift(opBid >= goodBid);
        }

        // Keep track of the posession arrow
        if(myBid > 0 && myBid === opBid) {
            if(prevGold[0] === this.gold)
                behav.tieBreaker.unshift(0);
            else
                behav.tieBreaker.unshift(1);
        }
        
        behav.urgency.unshift(this.urgencyFunc());
        
        // Record last turn's behavior in the appropriate bucket
        behav.bidBuckets.allBids.push(opBid);
        
        if(this.curTurn === 1) // wasTurnZero
        {
            behav.bidBuckets.turnZero.push(opBid);
        }
        if(this.curTurn < 6)
        {
            behav.bidBuckets.early.push(opBid);
        }
        if(this.wasNoneOwned)
        {
            behav.bidBuckets.noneOwned.push(opBid);
        } else if(this.wasClutch) // These 2 are mutually exclusive
        {
            behav.bidBuckets.clutch.push(opBid);
        }
        if(this.wasNoInterest)
        {
            behav.bidBuckets.noInterest.push(opBid);
        }

        // If the opponent *never* bids more than some low amount, then clamp it there
        var maxClamp = Math.max.apply(Math, behav.bidBuckets.allBids);
        
        // Come up with some bid values based on opponent's behavior
        var bidValues = {
            turnZero: clamp(Math.max.apply(Math, behav.bidBuckets.turnZero), 7, 17),
            early: clamp(this.percentile(behav.bidBuckets.early, 0.5), 6, 17),
            earlyMore: this.percentile(behav.bidBuckets.early, 0.8),
            standard: clamp(this.percentile(behav.bidBuckets.allBids.filter(function(bid) { return bid > 0; }), 0.5), 7, 17),
            clutch: clamp(Math.max.apply(Math, behav.bidBuckets.clutch), 14, 28),
            noInterest: clamp(avg(behav.bidBuckets.noInterest.filter(function(bid) { return bid > 0; })), 1, 7),
            maxClamp: maxClamp,
            boring: this.calcBoring(behav.bidBuckets.allBids)
        };
        
        this.bidValues = bidValues;
        
        // Write back the clone
        this.behavior = behav;
        
        if(this.debugBehav) this.debug("behavior, bidValues",behav, bidValues);
    };
    
    /**
     * Determine what I want to bid, given the choices that I have and the overall game state.
     */
    this.calcBidFunc = function(choices) {
        var candidate = choices.scoredTiles[0];
        var score = candidate.score.score;
        
        // Modify the score: Ignore op's perspective if:
        // 1) We're low on cash or
        // 2) They're out of gold
        if(this.gold < 20 || this.opGold === 0)
        {
            score -= 0.25 * candidate.score.opUsefulness;
            score -=  0.1 * candidate.score.opLossPenalty;
            if(this.debugCalcBid) this.debug("BID: Ignoring op perspective");
        }
        
        // If this is for the win, bid everything :)
        if(score == Number.POSITIVE_INFINITY) {
            if(this.gold + 1 - this.tb() > this.opGold) {
                this.debug("**** Good game, better luck next time :) -- mdz, "+this.team+" ****");
                this.smile();
            }
            return this.gold;
        }
        
        if(score > 0 && this.opGold === 0)
            return 1;
        
        this.wasNoInterest = false;
        this.wasNoneOwned = false;
        this.wasClutch = false;
        
        ///////////////////////////////////////////
        var myBid = 0;
        ///////////////////////////////////////////
        if(choices.endGame) {
            myBid = this.opGold + this.tb();
            
            if(this.isEndGameAware()) {
                myBid = this.opGold + this.tb();
                if(this.debugCalcBid) this.debug("Need to prevent endgame", this.behavior.endGameAware);
            } else {
                // If they're not endgame-aware, max out at whatever their max bid has been + tie breaker
                myBid = this.bidValues.maxClamp + this.tb();
                if(this.debugCalcBid) this.debug("Clamping endgame to "+myBid, this.behavior.endGameAware);
            }
            
            if(this.behavior.endGameAware.length > 1 && this.isEndGameAware() &&
                this.gold - 1 + this.tb() < this.opGold)
                this.debug("**** Good game, nice job :) -- mdz, "+this.team+" ****");
        }
        ///////////////////////////////////////////
        else if(this.curTurn === 0)
        {
            // TODO Tie-beat their opening bid from the last round, or maybe use the 90% value described below?
            myBid = this.bidValues.turnZero + this.tb();
            if(myBid === 0)
                myBid = 1;
            if(this.debugCalcBid) this.debug("BID: first",myBid);
        }
        else if(!this.ranBFS)
        {
            // This section doesn't use the actual value of score to indicate anything but fitness.
            // So now i'm free to calculate whatever I want in quickie() and not scale it down :)
            if(this.urgency() < 1)
                myBid = this.bidValues.early - 1;
            else if(this.urgency() < 3)
                myBid = this.bidValues.early + this.tb();
            else
                myBid = this.bidValues.earlyMore + this.tb();
            if(this.debugCalcBid) this.debug("BID: early",this.urgency(),myBid);
        }
        ///////////////////////////////////////////
        else if(this.opponentTiles.length === 0)
        {
            this.wasNoneOwned = true;
            // Urgency is low, so bid something low.
            // TODO calculate a bid that is 90% likely to beat whatever they bid.
            //      If that value is < 17, bid that + tb()
            myBid = this.bidValues.standard + this.tb();
            if(this.debugCalcBid) this.debug("BID: nothing owned",myBid);
        }
        ///////////////////////////////////////////
        else if(this.ranBFS && this.bfsTiles.shortestLength == 2 && candidate.score.usefulness > 0)
        {
            if(this.ignoreClutch(score))
            {
                myBid = 1;
                if(this.debugCalcBid) this.debug("BID: almost there, ignoring clutch",myBid);
            } else {
                myBid = this.bidValues.clutch;
                if(this.debugCalcBid) this.debug("BID: almost there",myBid);
            }
        }
        ///////////////////////////////////////////
        else if(choices.opInterest === 0 && score < 1)
        {
            this.wasNoInterest = true;
            // Op isn't interested in *any* tile this round (for offense anyway), so maybe we can bid lower
            myBid = this.bidValues.noInterest;
            if(this.debugCalcBid) this.debug("BID: No interest",myBid);
        }
        ///////////////////////////////////////////
        else if(score > 1)
        {
            this.wasClutch = true;
            myBid = this.bidValues.clutch;
            if(this.debugCalcBid) this.debug("BID: clutch",myBid);
        }
        else if(score > 0.6 || this.urgency() > 2) {
            myBid = this.bidValues.standard + 1 + this.tb();
            if(this.debugCalcBid) this.debug("BID: > 0.6",myBid);
        }
        else if(score > 0.2 || this.urgency() > 1)
        {
            myBid = this.bidValues.standard + this.tb();
            if(this.debugCalcBid) this.debug("BID: > 0.2, urg",myBid);
        }
        ///////////////////////////////////////////
        else if(score > 0)
        {
            // If it's at all useful then maybe we should buy it. It's only $1 :)
            myBid = 1;
            if(this.debugCalcBid) this.debug("BID: > 0",myBid);
        }
        
        
        // At this point, we've got a good idea of what we want to bid. now for some special cases:
        
        // If the opponent never goes over some value, and it's within reach, just do that
        if(!choices.endGame && this.round > 0) {
            if(this.debugCalcBid && this.bidValues.maxClamp + this.tb() < myBid)
                this.debug("MaxClamping to "+this.bidValues.maxClamp + this.tb());
            myBid = Math.min(myBid, this.bidValues.maxClamp + this.tb());
        }
        
        // If the opponent is 2 steps away from victory, we probably want to block them now
        // So we're not spending a lot on preventing endgame
        if(this.ranBFS && this.opBfsTiles.shortestLength == 2 && choices.opInterest > 0)
        {
            if(candidate.score.usefulness > 0)
            {
                myBid = Math.ceil(this.gold / this.bfsTiles.shortestLength);
                if(this.gold > this.opGold)
                {
                    // TODO should we increase or decrease the bid?
                    myBid += Math.max(0,this.bfsTiles.shortestLength - 2);
                }
            }
            else
            {
                // TODO is this a good heuristic?
                myBid = Math.min(29, Math.max(myBid, this.gold - this.opGold));
            }
            if(this.debugCalcBid) this.debug("Trying to block pre-endgame. usefulness: "+candidate.score.usefulness+", bid: "+myBid);
        }
        
        // If the opponent has a fairly static bidding strategy (e.g. bid 16 almost every turn),
        // and their static bid is lower than what I was planning on bidding,
        // then I'm willing to "trade ties" with them until later in the game.
        if(this.bidValues.boring > -1 && this.urgency() < 2 &&
            (this.curTurn < 5 || (this.ranBFS && this.opBfsTiles.shortestLength > 2)))
        {
            myBid = Math.min(myBid, this.bidValues.boring);
            if(this.debugCalcBid) this.debug("Clamping to boring: "+myBid);
        }
        
        if(this.ranBFS) {
            if(!choices.endGame && this.bfsTiles.shortestLength  <= 2 &&
            candidate.score.usefulness === 0 && score > 0)
            {
                // Don't spend much on blocking if I'm close to winning.
                // Maybe make this decision based on mygold vs opgold
                myBid = 3;
            }
        
            // Leave enough to spend 1 gold on the rest of my path :(
            myBid = Math.min(myBid, this.gold - this.bfsTiles.shortestLength + (candidate.score.usefulness > 0 ? 1 : 0));
        }
        
        // Don't bid less than 0...
        if(myBid < 0) myBid = 1;
        
        // Don't bid more than I have, nor more than I need to
        myBid = Math.min(myBid, this.gold, this.opGold + this.tb());

        return myBid;
    };
    
    this.isEndGameAware = function() {
        if(this.behavior.endGameAware.length == 1) return true;
        
        var awareCount = this.behavior.endGameAware.filter(function(b) { return b;}).length;
        var notAware = this.behavior.endGameAware.length - awareCount;
        
        
        // **** NOTE: THIS CHANGE IS ONLY GOOD FOR HUMAN SIDE, TO BEAT NAFAYA AND THEIR CRAZY WAYS.
        //      THE awareCount - notAware method of determining awareness is needed for ogre side.
        return awareCount > 0;
        //return  awareCount - notAware >= 0;
    };
    
    this.calcBoring = function(bids) {
        if(bids.length < 5)
            return -1;
            
        var bidCopy = bids.slice();
        bidCopy.sort();
        var mostCommon = -1;
        var last = -1;
        var count = 0;
        var maxCount = 1;
        for(var i=0;i<bidCopy.length;++i)
        {
            if(last != bidCopy[i])
            {
                last = bidCopy[i];
                count = 1;
            } else {
                if(++count > maxCount)
                {
                    mostCommon = bidCopy[i];
                    maxCount = count;
                }
            }
        }
        
        // If 70% of their bids are always this value, then they're pretty boring
        if(maxCount >= 0.6 * bidCopy.length)
            return mostCommon;
        return -1;
    };
    
    /**
     * If we're close to the end of the game, but opGold is still high, then we want to spend
     * as little as possible on our remaining tiles.
     */
    this.ignoreClutch = function(score) {
        if(!this.ranBFS) return false;
        if(this.opBfsTiles.shortestLength == 1 && choices.opInterest === 0 &&
            (score < 1 || this.gold < 2*this.opGold + 1))
            return true;
        return false;
    };
    
    //////////////////////////////////////////////////////////////////////////////
    /////  Highlight Stuff :)
    
    
    this.smile = function() {
        var smileTiles = [[0,3],[1,2],[2,1],[3,1],[4,1],[5,2],[6,3], // Mouth
                          [1,6],[1,5],[2,6],[2,5],                   // Left eye
                          [4,6],[4,5],[5,6],[5,5]];                  // Right eye
        for(var i = 0;i < smileTiles.length;++i)
        {
            this.highlightTile(this.getTile(smileTiles[i][0],smileTiles[i][1]));
        }
    };
    
    this.showUsefulTiles = function(dir) {
        var pathCounts = (dir == myDir) ? this.bfsTiles.pathCounts : this.opBfsTiles.pathCounts;
        for(var y = 0;y < 7;++y)
            for(var x = 0;x < 7;++x)
                if(pathCounts[7*y+x] > 0) {
                    var t = this.getTile(x,y);
                    if(!t.owner) this.highlightTile(t);
                }
    };

    
    //////////////////////////////////////////////////////////////////////////////
    /////  Boring helper functions
    
    this.myClone = function(obj) {
        var copy;

        // Handle the 3 simple types, and null or undefined
        if (null === obj || "object" != typeof obj) return obj;

        // Handle Date
        if (obj instanceof Date) {
            copy = new Date();
            copy.setTime(obj.getTime());
            return copy;
        }

        // Handle Array
        if (obj instanceof Array) {
            copy = [];
            for (var i = 0, len = obj.length; i < len; i++) {
                copy[i] = this.myClone(obj[i]);
            }
            return copy;
        }

        // Handle Object
        if (obj instanceof Object) {
            copy = {};
            for (var attr in obj) {
                if (obj.hasOwnProperty(attr)) copy[attr] = this.myClone(obj[attr]);
            }
            return copy;
        }
    };
    
    // Workaround for skeltoac.. so weird
    this.initMyTiles = function() {
        var myTileGroups = [[],[],[],
                            [],[],[],[]];
        var abc = "ABCDEFG";
        for(var yy = 0;yy<7;++yy) {
            for(var xx = 0;xx<7;++xx) {
                var t = this.getTile(xx,yy);
                myTileGroups[abc.indexOf(t.tileGroupLetter)].push(t);
            }
        }
        this.myTileGroups = myTileGroups;
        // TODO we could remove tiles from myTileGroups as they are purchased, then we wouldn't have to use filter()...
    };
    
    this.resetUninterestingTiles = function() {
        if(this.debugJunk1) this.debug("Resetting junk due to block!");
        // We've apparently been blocked, so we need to find a new path around it.
        this.junk = this.myClone(this.junkReset);
        
        this.opponentTiles.forEach(this.updateUninterestingTiles, this);
        this.myTiles.forEach(function(tile) { if(!this.junk[x(tile)][y(tile)]) this.updateUninterestingTiles(tile); }, this);
    };
    
    this.updateUninterestingTiles = function(tile) {
        // If we had a nobid-nobid turn, then there's nothing to do
        var junk;
        
        if(tile.owner != this.team) {
            if(this.junk[x(tile)][y(tile)]) {
                if(this.debugJunk) this.debug("Already marked "+tile.id+" as junk");
                return;
            }
            junk = this.myClone(this.junk);
            junk[x(tile)][y(tile)] = true;
            if(this.debugJunk) this.debug("Marking "+tile.id+" as junk");
        } else {
            // Mark the other tiles in this column as junk
            junk = this.myClone(this.junk);
            var i = x(tile);
            var added = false;
            for(var j=0;j<7;++j)
                if(j != y(tile) && !junk[i][j])
                    junk[i][j] = added = true;
            if(!added) {
                if(this.debugJunk) this.debug("Already marked column of "+tile.id+" as junk");
                return;
            }   
        }
        
        var coordsToStr = function(x,y) { return myDir ? x+"."+y : y+"."+x; };
        
        var addedCol = [x(tile)];
        
        var beval=function(b) { return b; };
        while(addedCol.length > 0)
        {
            i = addedCol.pop();
            // If every tile in a column is not usable, then we've reached a block situation.
            if(junk[i].every(beval))
                return this.resetUninterestingTiles();
            
            var addedLeft = false;
            var addedRight = false;
            var lastJunkJ = -1;
            var contiguous = 1;
            for(j=0;j<7;++j) {
                if(junk[i][j])
                {
                    if(j === lastJunkJ + 1)
                    {
                        ++contiguous;
                        
                        if(contiguous >= 3) {
                            // We're blocking something
                            if(i > 0)
                            {
                                // left
                                if(!junk[i-1][j-1]) {
                                    if(!addedLeft)
                                        addedCol.push(i-1);
                                        
                                    junk[i-1][j-1] = addedLeft = true;
                                    
                                    if(this.debugJunk) this.debug("Marking "+coordsToStr(i-1,j-1)+" as junk");
                                }
                            }
                            if(i < 6)
                            {
                                // right
                                if(!junk[i+1][j-1]) {
                                    if(!addedRight)
                                        addedCol.push(i+1);
                                    junk[i+1][j-1] = addedRight = true;
                                    if(this.debugJunk) this.debug("Marking "+coordsToStr(i+1,j-1)+" as junk");
                                    
                                }
                            }
                        }
                        
                        // Have to check top row special
                        if(j == 6 && contiguous >= 2) {
                            if(i > 0 && !junk[i-1][6])
                            {
                                // left
                                if(!addedLeft)
                                        addedCol.push(i-1);
                                junk[i-1][6] = addedLeft = true;
                                if(this.debugJunk) this.debug("Marking "+coordsToStr(i-1,6)+" as junk");
                            }
                            if(i < 6 && !junk[i+1][6])
                            {
                                // right
                                if(!addedRight)
                                        addedCol.push(i+1);
                                junk[i+1][6] = addedRight = true;
                                if(this.debugJunk) this.debug("Marking "+coordsToStr(i+1,6)+" as junk");
                            }
                        }
                    } else {
                        contiguous = 1;
                    }
                    lastJunkJ = j;
                }
                else
                {
                    contiguous = 1;
                }
            }
            
        }
        
        // Write back results
        this.junk = junk;
    };
    
    this.myGetTile = function(x,y,dir) {
        if(dir == HORIZ) return this.getTile(x,y);
        else return this.getTile(y,x);
    };
    
    this.getGold = function(turn) {
        var mine = myDir ? turn.humanGold : turn.ogreGold;
        var theirs = myDir ? turn.ogreGold : turn.humanGold;
        return [mine,theirs];
    };
    
    this.urgency = function() {
        return this.behavior.urgency[0];
    };
    
    this.tb = function() {
        return this.behavior.tieBreaker[0];
    };
    
    this.reset49 = function() {
        return this.zeros.slice();
    };
    
    this.getBidValue = function(turn, dir, invalidNull) {
        var t = (dir == HORIZ) ? turn.humanBid : turn.ogreBid;
        if(t.invalidBid || t.invalidTile)
            return invalidNull ? null : 0;
        else
            return t.bid;
    };

}

//////////////////////////////////////////////////////////////////////////////
/////  HERE WE GO!

if(this.debugAny) this.debug("**** STARTING ROUND "+this.round+" GROUP "+tileGroupLetter+" TURN "+this.curTurn);
   
// Includes Path Calc
this.turn_init();

// Bid Behavior Prep
this.bidding_init();

// Score the tiles
var choices = this.scoreTiles();

// What are we going to do?
var result = this.finalSolution(choices);

// Smile, or display interesting tiles
if(this.curTurn === 0)
    this.smile();
else if(this.debugHighlight)
    this.usefulFunc(myDir);

return result;
