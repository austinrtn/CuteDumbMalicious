# Changes to Peek suit
- Instead of the suit that is to be revealed to the peek-player to be random, it should be the primary suit of the card containing the seal (like resistence or booster seals)
- If player plays two/three peek seals of different primary suits, those should be revealed as well
- If player plays multiple peek seals of the same suit, one should apply and the rest should be converted to static 
- If peek card is sentinel, all suits should be revealed to player, any other peek cards should be converted 

```zig
fn getSubmittedPoints(cards: []Card, points: *Points) void {
    for(cards) |*card| {
        switch(card.seal) {
            .RESISTANCE => applyResSeal(card, points),
            .TAX => applyTaxSeal(card, points),
            .PEEK => {
                if(points.played_peek) {
                    card.seal = .STATIC;
                }
                else points.played_peek = true;
            },
            .BOOSTER => {
                var convert_static = false;
                switch(card.primary.suit) {
                    .CUTE => {
                        if(points.booster.cute) { convert_static = true; }
                        else { points.booster.cute = true; }
                    },
                    .DUMB => {
                        if(points.booster.dumb) { convert_static = true; }
                        else { points.booster.dumb= true; }
                    },
                    .MALICOUS=> {
                        if(points.booster.mal) { convert_static = true; }
                        else { points.booster.mal = true; }
                    },
                }

                if(convert_static) {
                    card.seal = .STATIC; 
                }     
            },
            .SWAP => {
                if(points.played_swap) {
                    card.seal = .STATIC;
                }
                else points.played_swap = true;
            },
            else => {},
        }
        points.cute += getPointsFromCard(card.*, .CUTE);
        points.dumb += getPointsFromCard(card.*, .DUMB);
        points.malicous += getPointsFromCard(card.*, .MALICOUS);
    }
}
````
