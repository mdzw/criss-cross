Criss-Cross Strategy
====================
I broke the problem down into two sub problems: what to bid _on_, and what to bid.

Tile Scoring: Path-Based
------------------------
This portion is very much a mathematical undertaking. A basic outline:

  1. Determine the set of all tiles that lie on any shortest path (using heavily specialized Dijkstra)
  2. Count how many unique paths use each tile (Depth-First Search on graph structure built in step 1)
  3. Divide path count by the total number of paths.
  4. Repeat steps 1-3 from the opponent’s perspective.

The number of paths which use a tile is a great metric for its value. By buying the most-used tile, I keep my options open for the number of potential paths I can pursue.  
Normalizing (Step 3) is useful because if any tile has a score of 1.0, that means that _every_ shortest-length path goes through that tile. So if my opponent buys that tile, I will have to buy at least 2 tiles to make up for it. This is helpful when determining how much to bid.

The number of turns that would have to pass for me to acquire a particular path is also a factor, but I never made much progress with using it effectively. For example, two possible paths: [A1 B] [A2 C] – if we’re bidding on A, we should buy A1, so that we can potentially win on the very next turn instead of waiting for turn C.

Tile Scoring: Early Turns
-------------------------
Running Dijkstra on a completely empty board is both computationally expensive and completely unnecessary. If the following conditional that defines “early game” is met, then I run my “Quick and Dirty” (QnD) evaluator:
```javascript
if((myTiles < 2 && opponentTiles < 4) ||
   (myTiles < 5 && opponentTiles < 3))
```
QnD values tiles that:
* Make progress toward a finished path (anything in the gray boxes in the example below)
* Are not currently in the “shadow” of an opponent’s blocking tiles (e.g. next to 3 in a column)
* Are adjacent to one or two of my tiles
* Are close to being in line (horizontally for humans) with my tiles
* Partially block an opponent path

[ example image ]  
With these attributes combined, QnD quickly/cheaply picks tiles very similar to those chosen by the more expensive Path-Based solution, especially in early turns. However, because QND does not actually search for paths, it’s possible that the opponent could have blocked me. This is mostly mitigated because I only run it very early in the game, before most blocks could develop. If a block does occur then it will hopefully be overcome in later turns when I _am_ calculating paths.

Bid Calculation
---------------
This is pretty ad hoc and dirty, with a lot of conditionals based on specific game states. Some highlights:

* To Be Populated once the competition is over :)

Appendix A: Binary Search Bid Calculation
-----------------------------------------
There is a very elegant and mathematical way to determine the best bid in some situations. The best way I can summarize it is:
> "Find a __bid value__ such that __if I buy__ my desired tile for this amount, I will win the game, and __if I am outbid__ for this or some other tile, I _still_ win the game (i.e. the opponent spent too much by outbidding me)."

It uses binary search on the bid value, and is very similar to minimax. I actually implemented it, but found that (at least with my code) it was too computationally expensive; I had to explore the future state tree too far to get a useable answer. So I scrapped it and went back to hacking more effective gamestate conditionals in to my bid calculation :)

Note: I’ve ignored bid ties and other minutia for simplicity of the pseudo code.
```javascript
function determineBid(gamestate, mygold, opgold) {
  if(winning(gamestate)) return WIN;
  if(losing(gamestate)) return LOSE;
  myFutureState = getFutureState(gamestate, me);
  opFutureState = getFutureState(gamestate, op);
  lowerBound = 0; upperBound = mygold;
  bidValue = mygold / 2;
  while(lowerBound < upperBound) {
    myResult = determineBid(myFutureState, mygold – bidValue, opgold);
    opResult = determineBid(opFutureState, mygold, opgold – bidValue);
    if(myResult === WIN && opResult === WIN)
    	// if we bid bidValue, no matter if we win the bid or lose the bid, we’ll WIN the game
    	return WIN;
    else if(myResult === LOSE && opResult === LOSE)
    	// if we bid bidValue, no matter if we win the bid or lose the bid, we’ll LOSE the game
    	return LOSE;
    else if(myResult === WIN && opResult === LOSE)
    	// op can win if they outbid me; bid higher:
      lowerBound = bidValue; bidValue = avg(bidValue, upperBound);
    else if(myResult === LOSE && opResult === WIN)
    	// op can win if they let me bid this high; bid lower: 
      upperBound = bidValue; bidValue = avg(bidValue, lowerBound);
  }
}
```
