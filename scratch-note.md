and it is also that when you scroll down, it pauses the video and when you scroll back up, it continues and that is just seamless as well.

n modern web development, you don't actually track the "scroll" event to do this, because listening to scroll events is notoriously bad for performance (it fires hundreds of times a second).

Instead, the secret ingredient here is a browser API called IntersectionObserver.



How IntersectionObserver Works

Rather than constantly doing math to figure out where the scrollbar is, IntersectionObserver essentially lets you hand an HTML element to the browser and say: "Tap me on the shoulder when this element enters or leaves the screen



Or is it more precise and more professional to do with the scroll mat math and stuff like this with React code?

