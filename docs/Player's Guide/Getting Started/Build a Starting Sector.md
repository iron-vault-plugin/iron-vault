Now that we have a character, the next step is to create our first sector. You can find the process for this on p. 114 of the Starforged Rulebook.

Generating your starting sector is a 10-step process, so expect it to take a while, and remember that [[Initial Setup#Prep is Play|Prep is Play]]!

Before we start, it's worth noting that this part of the guide involves a lot of suggestions on how to represent your sector and things in it. Remember that you're free to structure your campaign however you want! Obsidian is a very flexible tool. In the interest of not getting too deep in the weeds with what's out there, though, we've documented a "happy path" that you can get started with and transform into what's most ideal for you. See the [[Sectors]] documentation for other ideas.

### Sector Generation Steps

This guide will go over the following steps of sector generation:

1. [[#Choose your starting region]] (p. 116)
2. [[#Determine the number of settlements]] (p. 116)
3. [[#Generate settlement details]] (p. 117)
4. [[#Generate planets]] (p. 118)
5. [[#Generate stars]] (optional) (p. 118)
6. [[#Create a sector map]] (p. 119)
7. [[#Create passages]] (p. 120)
8. [[#Zoom in on a settlement]] (p. 122)
9. [[#Create a local connection]] (p. 123)
10. [[#Introduce a sector trouble]] (p. 126)
11. [[#Finalize your starting sector]] (p. 126)
12. [[#Next steps]]

#### Choose your starting region

For this example, we're going to use [Obsidian Canvas](https://obsidian.md/canvas) to represent regions. It's a very flexible tool that gives us all of the pieces we need to have an interesting and visually-appealing region that we can link to!

We start by running the "Create a canvas" command, or by clicking on the "Create new canvas" Ribbon button.

We also move that canvas into a "Locations/Sectors" folder in our vault, to keep things organized.

Don't worry about giving it a name for now: that's our last step!

![[sector-initial.png]]

Once that's done, we can complete Step 1 by adding a new card to our Canvas that we'll use for basic sector details. You can turn this into a note later if you'd like, too.

Go ahead and make a card using the Canvas interface, then pick which region to start in. Iron Vault also includes an unofficial Region oracle that you can find under "Homebrew" in the sidebar, if you're having trouble deciding.

![[sector-region.png]]

Let's move on.

#### Determine the number of settlements

Once that's done, this step is simple: make note of how many settlements we'll need to generate based on what you picked for your starting region.

#### Generate settlement details

Now it's time to generate the settlements themselves! For this, we switch back to our Session 0 journal, because we'll be rolling some oracles!

Iron Vault lets you roll multiple oracles at the same time by going to the [[Sidebar#Oracle Tab|Sidebar's Oracle Tab]] and pressing the dice icon on any oracle _group_. Some of these oracle groups, though, have special semantics, and we call those rollable [[Entities/index|Entities]].

Generating an entity is easy: run the [[Generate an entity]] command, or click on the corresponding dice icon for the entity you want to roll. You'll see a list of supported entities pop up in a list. In our case, we want to generate a _Settlement_, so we pick that entity.

The next prompt will ask you what region you want to generate this in, which you can optionally roll.

Then, you'll get a popup that looks like this:

![[generate-entity-modal.png]]

This includes all oracles related to this entity that you might want to roll. The Rulebook, however, specifies only a subset of them for initial generation. We can roll only those oracles by clicking "Roll First Look":

![[generate-entity-modal-filled.png]]

Make sure you have the Session 0 note open, then **toggle on the "Create entity file" setting**, and click accept. You'll end up with a new note in your vault, and a bunch of oracle rolls recorded in your Session 0 note, for future reference. While you're at it, move your new settlement into a "Locations/Settlements" folder in your vault:

![[first-settlement.png]]

Go ahead and do this for the rest of the settlements you're supposed to generate, up to the recommended number, then we can move on.

#### Generate planets

Planets are also entities, so we can repeat this process for any settlements that are either planetside, or in orbit of a planet. This time, we'll move them to a "Locations/Planets" folder:

![[generated-planets.png]]

If you don't like a name, or if you want to manually edit one of the generated fields, you can go ahead and edit the note for the planet itself (you can do this for settlements, too, of course).

The last step with planets is to associate them with the settlements we generated them for. This is a two step process: add a link from the planet to the settlement, then another from the settlement to the planet, for convenience. This part is optional but can be helpful!

To add these links, just open up your settlement and click on the right-hand column next to location, then type `([[NameOfPlanet]])` next to where the location is, and a link will be created, like so:

![[edited-settlement-planet.png]]

And then we do the inverse in the Planet note:

![[edited-planet-settlement.png]]

Repeat this for all your planet/settlement pairs, and we're done with this step!

#### Generate stars

This step is optional, but we may as well look at how to do it here, too. Generating a star doesn't even require entity generation: it's a simple oracle roll on the Stellar Object oracle:

![[stellar-object-oracle-rolls.png]]

If you want, you can either create new notes for these and hash them out some more, give them names, etc. Or, if you want to keep it simple, just add a row to your planets' notes with the results of the oracle:

![[planet-with-star-row.png]]

#### Create a sector map

Now that we have all our bits together, it's time to set up our sector map in more detail!

Go back to your sector Canvas from before. Then, add a new note to the Canvas with all of your elements and arrange them how you'd like. I like putting planets and settlements in a Canvas Group named after either the planet or the star so I can drag them around together while having them both right on the map:

![[sector-with-stuff.png]]

There's a lot more you could do here to gussy it up, but as the Rulebook says, I like to keep it simple. I can make it fancier later!

#### Create passages

Now that we have things on our map, let's connect them!

Obsidian Canvas supports connecting nodes with edges, just like what we need to do our passages! To create an edge, first hover over one of the sides of your nodes. You'll see a small circle pop up right in the middle. If you grab this circle, you can drag a line all the way to another node or node group, and it will connect them! I like to also change the arrow type to "nondirectional", and give them a color. Sometimes I color code them based on what kind of journey it is, but that's up to you.

![[sector-with-passages.png]]

#### Zoom in on a settlement

Once you have everything set up, it's time to pick one settlement you'd like to zoom into. First, we'll go back to our section for settlements and add a new sub-header: `#### Zooming in: [[NameOfSettlement]]`Then, we'll use the [[Ask the Oracle]] command, or search in the [[Sidebar#Oracle Tab|Sidebar]] for "settlement oracles".

The Rulebook suggests we roll the following, so we'll do that:

* First Look (1-2 times)
* Settlement Trouble

Once you have those in your Session 0 journal, you can simply copy/paste them to the corresponding table for your settlement in that settlement's note!

![[zoomed-in-settlement.png]]

#### Create a local connection

For this, we don't have to [[Make a move]], since we're supposed to assume an automatic strong hit, so we'll just do the next step: [[Generate an entity]] and picking "Character". Following the same process as with Planets and Settlements, make sure you've checked "Create entity file". For this, you might also want to click on the dice icon to roll for a Character Role, and then click Accept.

For NPCs, I like to make an "NPCs" folder in my vault, then I can move my new connection in there:

![[generated-connection.png]]

We're not quite done, though: a Connection is a type of progress track. Going back to our Session 0 journal, we run the [[Create a progress track]] command and fill it out, then press "Create":

![[new-progress-trap-modal.png]]

Finally, we go to the NPC note and, under the roll results table, we add an embedded link to our new progress track: `![[Name of Connection Track|iv-embed]]`. You'll end up with something like this:

![[embedded-connection-track.png]]

The `|iv-embed` part is optional, but it makes it so the usual embed decorations from Obsidian don't show up, making it look more like it's more part of the page.

At this point, you can do the rest of the connection creation by going back to Session 0 and rolling the rest of the recommended character oracles:

* First Look (1-2 times)
* Character Goal
* Revealed Character Aspect (1-2 times)

And add them to the NPC's results table just like we did with the zoomed-in settlement.

Finally, add another row to your NPC's table called "Location", and link the settlement you'd like to put them in, to wrap up your first connection:

![[completed-connection.png]]

#### Introduce a sector trouble

Going back to our Session 0 journal, we put our cursor under our "Starting Sector" header (or wherever you want oracle results to show up), and we go ahead and roll on the Sector Trouble table: 

![[sector-trouble.png]]

#### Finalize your starting sector

To finish up, we either come up with or roll the Sector Name oracle, then we go back to our Sector map and add both the Sector Trouble and the Sector Name to that sector information card we made earlier, which only has the Region in it so far:

![[finalized-sector.png]]

If you want, you can do what I did and make the card's contents into a [Markdown table](https://www.markdownguide.org/extended-syntax/#tables) to make it look nicer.

#### Next Steps

And with that, we've completed the entire Starting Sector guide! Following along with the Starforged Rulebook, that means you're ready to [[Begin Your Adventure]] and see what it's like to get into the rest of gameplay using Iron Vault!
