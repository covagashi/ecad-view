var jumpurl = getParam("jumpurl");
markTarget();
var curX = 0;
var curY = 0;
var curW = 0;
var curH = 0;
//zoomTarget();
deleteUnits();
highlightId();
search();

function search()
{
	var search = getParam("search");
	if (search)
	{
		var exp = new RegExp(search, "i");
		//var svg = document.getElementById("svgElement");
		//searchChildren(svg, exp);
		var topLevel = document.getElementById("transformLevel");
		for (var i = 0; i < topLevel.childNodes.length; ++i)
			searchChildren(topLevel.childNodes.item(i), exp);
	}
}

function searchChildren(node, exp)
{
	if (node.hasAttribute && node.hasAttribute("id"))
	{
		var val = node.textContent;
		if (val && exp.exec(val))
		{
			highlightIdInternal(node.getAttribute("id"), "gold");
		}
		return;	// found a function no need to recurse further
	}
	// recurse through the nodes
	for (var i = 0; i < node.childNodes.length; ++i)
		searchChildren(node.childNodes.item(i), exp);
}

function highlightId()
{
	var highlightId = getParam("highlightId");
	highlightIdInternal(highlightId, "green");
}

function highlightIdInternal(id, color)
{
	if (!id)
		return;
	var element = document.getElementById(id);
	if (element)
	{
		var rct = element.getBBox();
		var scale = getScaleOfElement(element);
		
		createRect(rct.x, rct.y, rct.width, rct.height, scale, color);
		var rectJSON = "{{" + rct.x + ", " + rct.y + "}, {" + rct.width + ", " + rct.height + "}}";
		
		return rectJSON;
	}
}

function getScaleOfElement(element) {
	var scale = 1;
		
	var elementIterator = element;
	while (elementIterator.parentElement) {
		elementIterator = elementIterator.parentElement;
		
		var transformContent = elementIterator.getAttribute('transform');
		if (!transformContent)
			continue;
		
		var scaleStringValue = transformContent.match(/.*scale\(([0-9.]+)\)/i);
		if (!scaleStringValue)
			continue;
		
		var scaleValue = parseFloat(scaleStringValue[1]);
		if (!scaleValue)
			continue;
		
		scale *= scaleValue;
	}
	
	return scale;
}

function createRect(x, y, width, height, scale, color)
{
	if (!color)
		color = "red";
	var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	rect.setAttributeNS(null, "x", x);
	rect.setAttributeNS(null, "y", y);
	rect.setAttributeNS(null, "height", height);
	rect.setAttributeNS(null, "width", width);
	rect.setAttributeNS(null, "fill", "none");
	rect.setAttributeNS(null, "stroke", color);
	rect.setAttributeNS(null, "stroke-width", 1 / scale);
	var grp = document.getElementById("transformation");
	var matrix = grp.getAttributeNS(null,"transform");
	rect.setAttributeNS(null, "transform", matrix + " scale(" + scale + ")");
	// ------ test
	//rect.setAttributeNS(null, "filter", "url(#MyFilter)");
	// ------ test
	document.documentElement.appendChild(rect);
}

// This function is used to remove the width and height attributes or the
// viewBox attribute of the svg element.  This is sometimes useful for embedding
// the svg diagram in a frame.
function deleteUnits()
{
	var svg = document.getElementById("svgElement");
	if (svg == null)
	{
		alert("Cannot get SVG Element");
	}
	var sizeInfo = getParam("sizeInfo");
	if (sizeInfo == "noUnits")
	{
		svg.removeAttribute("width");
		svg.removeAttribute("height");
	}
	if (sizeInfo == "noViewBox")
	{
		svg.removeAttribute("viewBox");
	}
}

// draw a box around the target object
function markTarget()
{   // SVG bounding box
    var highlightId = getParam("targetId");
    highlightIdInternal(highlightId, "green");
    // Eplan bounding box
    /*
    var x = getParam("x");
	var y = getParam("y");
	var height = getParam("height");
	var width = getParam("width");
	if (x != null && y != null && height != null && width != null)
	{
		createRect(x, y, width, height, "red");
	}
    */
}

function zoomTarget()
{
	var x = parseFloat(getParam("x"));
	var y = parseFloat(getParam("y"));
	var height = parseFloat(getParam("height"));
	var width = parseFloat(getParam("width"));
	if (x != null && y != null && height != null && width != null)
	{
		y -= 5;
		x -= 5;
		height += 10;
		width += 10;
		var svg = document.getElementById("svgElement");
		y = 297 - y - parseFloat(height);
		var vb = x + " " + y + " " + width + " " + height;
		svg.setAttribute("viewBox", vb);
		curX = x;
		curY = y;
		curW = width;
		curH = height;
		//svg.addEventListener("SVGZoom",doZoom,false);
		//svg.attachEvent("onzoom",doZoom);
		/*
		if (svg.addEventListener)
			svg.addEventListener("SVGZoom",doZoom,false);
		else if (svg.attachEvent)
			svg.attachEvent("onzoom",doZoom);
		else
			svg.onzoom = doZoom;
		*/
		svg.addEventListener("DOMMouseScroll", doZoom, false);
	}
}

function doZoom(event)
{
	var zoomLevel = 3;
	var svg = document.getElementById("svgElement");
	//var vb = svg.getAttribute("viewBox");
	if (curX > 0)
	{
		if (curX > zoomLevel)
			curX -= zoomLevel;
		else
			curX = 0;
	}
	if (curY > 0)
	{
		if (curY > zoomLevel)
			curY -= zoomLevel;
		else
			curY = 0;
	}
	if (curW + curX < 420)
	{
		if (curW + curX < 420 - zoomLevel)
			curW += zoomLevel;
		else
			curW = 420 - curX;
	}
	if (curH + curY < 297)
	{
		if (curH + curY < 297 - zoomLevel)
			curH += zoomLevel;
		else
			curW = 297 - curY;
	}
	var vb = curX + " " + curY + " " + curW + " " + curH;
	svg.setAttribute("viewBox", vb);
}

// get the named parameter from the argument list.  This does not use the
// html <param.../> because that didn't work in FireFox 3.6.
// update: it does work in FireFox but only if the !DOCTYPE is set in the HTML.
function getParam(name)
{
	if (document.defaultView) {
		var href = document.defaultView.location.href;
		//alert(href);
		if (href.indexOf("?") != -1)
		{
			var paramList = href.split("?")[1].split(/&|;/);
			for (var p = 0; p < paramList.length; ++p)
			{
				var pr = paramList[p].split("=");
				if (unescape(pr[0]) == name)
				{
					//alert(name + ": " + unescape(pr[1]));
					return unescape(pr[1]);
				}
			}
		}
	}
}

// Jump to the function on the given SVG document.  This calls the SVG document
// directly with the viewBox parameters.
function jumpToFunction(fileName,x,y,width,height,id,targetId,hasInstanceName/*,crossRef*/)
{
	if (jumpurl != null) {
	    jumpurl = jumpurl.replace("$filename$", escape(fileName).replace("+", "%2B"));
		jumpurl = jumpurl.replace("$x$", x);
		jumpurl = jumpurl.replace("$y$", y);
		jumpurl = jumpurl.replace("$width$", width);
		jumpurl = jumpurl.replace("$height$", height);
		jumpurl = jumpurl.replace("$id$", id);
        jumpurl = jumpurl.replace("$targetId$", targetId)
		top.location.href = jumpurl;
		
	} else {
    var target = fileName + "?x=" + x + "&y=" + y + "&width=" + width + "&height=" + height
        + "&id=" + id + "&targetId=" + targetId + "&hasInstanceName=" + hasInstanceName/* + "&crossRef=" + crossRef*/;
	top.location.href = target;
	}
}
