My Criss-Cross Tournament Experience
====================================
I remember taking a look at CodeCombat when they first launched. It was pretty fun, but at the time it was focused on learning to program; there wasn't really anything very challenging. A few months later, I put in a middling attempt at Greed, but never made it much more intelligent than "find the closest coinage and go there." When the Criss-Cross tournament was announced, I knew it was right up my alley: I have fond memories of hacking away at (and winning) [Kurt Eiselt's Oska competition](http://www.cs.ubc.ca/~eiselt/cs322/lectures/project.html) in my very first CS class at Georgia Tech (Go Jackets!) in the fall of 2002.  

I actually began the Criss-Cross competition with a less refined version of my "Quick and Dirty" evaluator described below. For one, I hadn't organized my thoughts about what a Path Based solution would look like. But also I wasn't sure if I could actually do the graph theory stuff, given the execution limit, my limited recent experience with JavaScript, and the API protection (more on that later).

So I wrote up a first draft that bid on tiles close to the center of the board, lying within in the "cone of reachability" of my previously-purchased tiles. If you can't imagine what that cone is, take a look at the example image down in the Tile Scoring section. You could also call it a "bow-tie of reachability" :). Then I added some smarts to prefer the center of the cone (fewer diagonal steps means fewer opportunities for the opponent to block me with one tile). This strategy got me pretty far up the ladder, and I was hooked.

When I buckled down and wrote the path-based solution, I feel like I may have been the first to that particular wateringhole. I shot up to first place, and I hadn't done much of anything intelligent with the bidding. I thought that maybe good tile selection was enough, and that bidding was a minor concern. A few days later, that proved to be terribly, terribly wrong.

Although my early time at the top was satisfying, watching the matches that I lost inspired me to keep working. Every time I analyzed my agent's behavior or that of my opponents, I looked for a generalized, abstracted solution to what went wrong. My goals were to fix that specific match, improve the overall strength of my agent, and not have any regressions against other agents that I was already beating.

For the remainder of the tournament, I checked up on who beat me and how, and I would tweak something to improve the overall robustness. I would say that everyone in the top 20 on both ladders had a hand in shaping my final solution, so I offer my sincerest thanks to all of my competitors. Overall, this experience has been extremely stimulating and a lot of fun. I would definitely do it again, but maybe not for the next month or two.. My wife and I have been caring for a newborn this whole time, and I think I prefer to only have one reason to be up at 3am for a while :)

API Protection
--------------
When my code basically threw everything away and started fresh on every turn, I had almost no trouble with the API Protection. However, when I eventually wanted to record bid behavior across turns and rounds, it was a bit of a hassle. I did a lot of array wrangling thusly:  

If I had an object:
```javascript
this.xyz = {someNumber: 8, someOtherNumber: 9};
```
I couldn't directly update either value; API Protection told me it was read-only. However, if I had this object:
```javascript
this.xyz = {someNumber: [8], someOtherNumber: [9]};
```
Then to update a value I could do ```this.xyz.someNumber.unshift(11)```. Then just always refer to ```this.xyz.someNumber[0]``` when I want the latest value. A bit annoying, but at least I got something working :)
Another method I used was to completely re-build a new object, referencing the values of the previous object or the updated values, and then over-writing ```this.xyz``` with the new object.

I know that these API protection issues affected other hackers, and it's a shame that some of them dropped out as a result. I know Nick and the CodeCombat team squashed more than a few protection bugs during the tourney, so thanks for all your hard work.

Criss-Cross Strategy
====================
I broke the problem down into two sub problems: what to bid _on_, and what to bid. When I began, I had much clearer ideas on the first problem than the second, so my bid strategy was "18 all day" until that was no longer good enough.

Step One: Identical code for Human and Ogre
-------------------------------------------
Because the game is symmetrical, I knew I could compete on both ladders with the same code if I just wrote an abstraction of rows vs columns. So that's what I did, and I switched on the value of ```this.team```. Once that was complete, I had instantly doubled the number of opponents I could play against. Since watching games develop was a huge part of my refinement process, this was a big help.

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
* Make progress toward a finished path (anything in the gray boxes in the example below. AKA the bow-tie of reachability)
* Are not currently in the “shadow” of an opponent’s blocking tiles (e.g. next to 3 in a column)
* Are adjacent to one or two of my tiles
* Are close to being in line (horizontally for humans) with my tiles
* Partially block an opponent path

![Imgur](http://i.imgur.com/YDUMHFD.png)  
With these attributes combined, QnD quickly/cheaply picks tiles very similar to those chosen by the more expensive Path-Based solution, especially in early turns. However, because QND does not actually search for paths, it’s possible that the opponent could have blocked me. This is mostly mitigated because I only run it very early in the game, before most blocks could develop. If a block does occur then it will hopefully be overcome in later turns when I _am_ calculating paths.

Bid Calculation
---------------
This is pretty ad hoc and dirty, with a lot of conditionals based on specific game states. I think I had two powerful advantages:
 1. Identifying the game states that were different or important in some way, and figuring out what to do in those situations
 2. Recording my opponent's bidding behavior (split into buckets based on the above game states), and using that to predict what they will do when a similar game state arises in the future (across multiple rounds). This let me automatically adapt my bids to many strategies, without explicitly identifying those stratigies:
    * I would save gold buying cheap tiles against opponents who bid super low early on
    * I would trade tile purchases against opponents who bid middle values
    * I would wait for opponents who bid way too high to exhaust their funds, and then clean up for cheap later (while easily outbidding them to prevent any winning tile purchases)

Some other bidding intelligence highlights:

* Keep track of the tie results, so we know if we’ll win a tie (save 1 gold every so often :)
* Never bid more than opponent's remaining gold + tiebreaker
* If there's a tile that would win you the game, bid everything on it
* If there's a tile that would give your opponent the win, make sure you bid on *something* with opGold + tiebreaker (It doesn't have to be that endgame tile, just something to prevent them from winning the bid that turn)
  * This one can be tricky -- if we have detected that the opponent doesn't bid everything on the endgame, we can try to save some money while still preventing the loss.
* If I’m low on gold or the opponent is out of gold, don’t use the opponent’s perspective (step 4 of Tile Scoring) to make bidding decisions. Basically, save gold for tiles I actually need
* If we don’t think the opponent is interested in any tile that’s up for bidding, lower the bid (opponent's interest is based on the Path-Based tile scoring from their perspective)
* If the opponent always bids some certain value, and that value is something low, then just outbid them
* Always try to leave enough gold to spend 1 on each remaining needed tile – this doesn’t seem to help (if we’re that low on gold, op will probably outbid us all day), but it’s a last ditch effort

Here is a strategy that I added on the last day, and it turned out to be pretty important against other top players (looking at you, HighSea):
* If the opponent is _two_ tiles away from a finished path, try pretty hard to outbid them. This is important because if they become _one_ tile away from a finished path, to stay alive you have to outbid all of their remaining gold every time a winning tile comes up. This exhausts funds pretty quickly. The specifics of “try pretty hard” are left as an exercise to the reader, but it’s based on how much gold I have left, how many tiles I need to buy, and how much gold my opponent has left.


Appendix A: Binary Search Bid Calculation
-----------------------------------------
There is a very elegant and mathematical way to determine the best bid in some situations. The best way I can summarize it is:
> "Find a __bid value__ such that __if I buy__ my desired tile for this amount, I will win the game, and __if I am outbid__ for this or some other tile, I _still_ win the game (i.e. the opponent spent too much by outbidding me)."

It uses binary search on the bid value, and is very similar to minimax. I actually implemented it, but found that (at least with my code) it was too computationally expensive; I had to explore the future state tree too far to get a usable answer. So I scrapped it and went back to hacking more effective gamestate conditionals in to my bid calculation :)

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

Appendix B: Path-Based Improvement
----------------------------------
My Shortest Path-Based tile scoring is pretty good, but there are a few situations where some additional metrics would be helpful. One example I identified too late to fix: Let's say I only need one more tile to win, but there is only one tile that could do the job (either it's a double-diagonal, or the opponent has blocked all other options). Sometimes it's worthwhile to buy some other tile that gives us more options. Specifically (I'm human, and we're currently bidding on A):  
![](http://i.imgur.com/qGAkTkc.png)  
In this case, my evaluator sees that only the G tile will help my _shortest_ path. Because neither 'A' helps _my_ shortest path, it would choose to bid on the yellow A, because it would help the opponent. However, the green A would give me 3 additional end-game options that the opponent would have to spend a lot of gold to prevent. Maybe I'll code this up to see how it does :)
