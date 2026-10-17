// overlay <in.jpg> <out.jpg> <text> — writes text in a white box across the middle of a photo.
import AppKit
let args = CommandLine.arguments
guard args.count == 4, let image = NSImage(contentsOfFile: args[1]) else { fatalError("usage") }
let rep = image.representations.first!
let size = NSSize(width: rep.pixelsWide, height: rep.pixelsHigh)
let out = NSImage(size: size)
out.lockFocus()
image.draw(in: NSRect(origin: .zero, size: size))
let box = NSRect(x: size.width * 0.05, y: size.height * 0.35, width: size.width * 0.9, height: size.height * 0.3)
NSColor(white: 1, alpha: 0.88).setFill(); box.fill()
let style = NSMutableParagraphStyle(); style.alignment = .center
let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.boldSystemFont(ofSize: size.width / 22),
  .foregroundColor: NSColor.black, .paragraphStyle: style]
(args[3] as NSString).draw(in: box.insetBy(dx: 8, dy: 8), withAttributes: attrs)
out.unlockFocus()
let bitmap = NSBitmapImageRep(data: out.tiffRepresentation!)!
try! bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.85])!.write(to: URL(fileURLWithPath: args[2]))
