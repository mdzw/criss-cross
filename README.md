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

* Keep track of the tie results, so we know if we’ll win a tie (save 1 gold every so often :)
* Never bid more than opponent's remaining gold + tiebreaker
* If there's a tile that would win you the game, bid everything on it
* If there's a tile that would give your opponent the win, make sure you bid on *something* with opGold + tiebreaker (It doesn't have to be that endgame tile, just something to prevent them from winning the bid that turn)
  * This one can be tricky -- if we have detected that the opponent doesn't bid everything on the endgame, we can try to save some money while still preventing the loss.
* If I’m low on gold or the opponent is out of gold, don’t use the opponent’s perspective (step 4 of Tile Scoring) to make bidding decisions. Basically, save gold for tiles I actually need
* If we don’t think the opponent is interested in any tile that’s up for bidding, lower the bid
* If the opponent always bids some certain value, and that value is something low, then just outbid them
* Always try to leave enough gold to spend 1 on each remaining needed tile – this doesn’t seem to help (if we’re that low on gold, op will probably outbid us all day), but it’s a last ditch effort
* To adapt to what my opponents’ various bid strategies might be, I track what the op bids in various situations. I then try to mimic or outbid them when similar situations arise in the future. This bid tracking persists across rounds, so if I lose in round 0, I come better prepared in round 1.

Here is a strategy that I added on the last day, and it turned out to be pretty important against other top players:
* If the opponent is _two_ tiles away from a finished path, try pretty hard to outbid them. This is important because if they become _one_ tile away from a finished path, to stay alive you have to outbid all of their remaining gold every time a winning tile comes up. This exhausts funds pretty quickly. The specifics of “try pretty hard” are left as an exercise to the reader, but it’s based on how much gold I have left, how many tiles I need to buy, and how much gold my opponent has left.


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
